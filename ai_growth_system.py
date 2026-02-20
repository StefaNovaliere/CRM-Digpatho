#!/usr/bin/env python3
"""
Digpatho AI Growth System — Intelligent B2B Prospecting
=========================================================

A 3-agent prospecting system that generates email drafts for human review.
This is NOT a spam bot. Every email is a draft requiring mandatory manual
approval before any communication is sent.

Architecture (3 Agents):
    SafeSearcher        → Google Dorking for LinkedIn prospects by vertical
    LeadManager         → Dedup, tag, insert leads into Supabase
    ContextualCopywriter → Generate vertical-aware email drafts (NEVER sends)

GTM Framework: Bull's-eye (Gabriel Weinberg)
    Inner Ring:  Direct Sales + Strategic Partnerships (DIRECT_B2B)
    Middle Ring: Influencers (INFLUENCER) + Events (EVENTS)
    Pharma Line: Companion Diagnostics & Clinical Trials (PHARMA)

Database: Supabase (PostgreSQL)
    Tables: growth_leads, growth_email_drafts
    See: migrations/001_growth_system_tables.sql

Usage:
    python ai_growth_system.py --vertical PHARMA --mode search
    python ai_growth_system.py --vertical DIRECT_B2B --mode draft
    python ai_growth_system.py --vertical all --mode full
    python ai_growth_system.py --vertical all --mode full --dry-run
"""

import argparse
import json
import logging
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Third-party imports (graceful degradation if missing)
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

try:
    from googlesearch import search as google_search
except ImportError:
    google_search = None  # type: ignore

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None  # type: ignore
    Client = None  # type: ignore

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s — %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("digpatho.growth")


# ============================================================================
# VERTICAL_CONFIGS — Full GTM strategy per vertical
# ============================================================================
# GTM Source: Bull's-eye Framework, Digpatho Go-To-Market Plan
# Each vertical maps to a channel from the Middle/Inner Ring.

VERTICAL_CONFIGS: Dict[str, Dict[str, Any]] = {

    # ------------------------------------------------------------------
    # VERTICAL 1: DIRECT_B2B
    # GTM: "The Inner Ring: Bull's-eye Focus", "Service Business Line",
    #       "LatAm GTM", "African GTM"
    # ------------------------------------------------------------------
    "DIRECT_B2B": {
        "display_name": "Direct B2B — Reference Centers & Labs",
        "gtm_source": (
            "Bull's-eye Inner Ring: Direct Sales to Reference Centers "
            "+ LatAm/Africa GTM sections"
        ),
        "target_roles": [
            "Medical Director", "Chief of Pathology", "Laboratory Director",
            "Head of Pathology", "Director Médico", "Jefe de Patología",
            "Director de Laboratorio",
        ],
        "target_institutions": [
            "Instituto Oulton", "Instituto Roffo", "Hospital de Ezeiza",
            "Dr. Lal", "University College Hospital", "Wits University",
        ],
        "target_geos": [
            "Argentina", "Brazil", "South Africa", "Nigeria",
            "Paraguay", "Uruguay", "Bolivia", "Peru",
            "Colombia", "Mexico", "Chile",
            "Kenya", "Ghana", "Ethiopia", "Tanzania",
        ],
        "search_queries": [
            # LatAm — English titles
            'site:linkedin.com/in "Medical Director" OR "Chief of Pathology"'
            ' OR "Laboratory Director" pathology Argentina OR Brazil',
            'site:linkedin.com/in "Head of Pathology" OR "Lab Director"'
            ' OR "Pathology Manager" laboratory Argentina OR Brazil OR Colombia',
            # LatAm — Spanish titles
            'site:linkedin.com/in "Director Médico" OR "Jefe de Patología"'
            ' patología oncología Argentina OR Brasil',
            'site:linkedin.com/in "Director de Laboratorio" OR "Jefe de Laboratorio"'
            ' OR "Coordinador de Patología" diagnóstico Argentina OR Colombia OR México',
            # LatAm — more countries
            'site:linkedin.com/in "Medical Director" OR "Lab Director"'
            ' OR "Director Médico" pathology Peru OR Chile OR Mexico OR Colombia',
            'site:linkedin.com/in "Pathologist" OR "Patólogo" OR "Director"'
            ' laboratory diagnosis Paraguay OR Uruguay OR Bolivia',
            # Africa — English titles
            'site:linkedin.com/in "Head of Pathology" OR "Lab Director"'
            ' diagnostic laboratory "South Africa" OR Nigeria',
            'site:linkedin.com/in "Medical Director" OR "Chief Pathologist"'
            ' OR "Laboratory Manager" Kenya OR Ghana OR Ethiopia OR Tanzania',
            'site:linkedin.com/in "Pathologist" OR "Lab Director"'
            ' OR "Histopathology" hospital "South Africa" OR "West Africa"',
            # Reference institutions globally
            'site:linkedin.com/in pathology OR histopathology "reference laboratory"'
            ' OR "reference center" director OR manager',
        ],
        "selling_points": [
            "$1,300 USD savings per case in LatAm markets",
            "5-10x throughput increase vs manual microscopy",
            "95% diagnostic accuracy",
            "28% reduction in diagnosis turnaround time",
            "Eliminates inter-observer variability",
            "SaaS model (no $50K-$300K upfront scanner cost)",
            "On Any Device philosophy (works without high-speed internet)",
            "Hub-and-spoke telepathology model",
        ],
        "email_tone": (
            "Operational, ROI-driven. Speak the language of lab "
            "administrators under volume and budget pressure."
        ),
        "email_cta": "15-minute demo call",
        "anti_patterns": [
            "NEVER mention HER2-low, companion diagnostics, clinical "
            "trials, or pharma pipeline to this vertical.",
        ],
    },

    # ------------------------------------------------------------------
    # VERTICAL 2: PHARMA
    # GTM: "Pharma Business Line (DSF)", "HER2-low and CDx",
    #       "Clinical Trial Support", "Week 11: Pharma Partner Expansion"
    # ------------------------------------------------------------------
    "PHARMA": {
        "display_name": "Pharma Partnerships — CDx & Clinical Trials",
        "gtm_source": (
            "Pharma Business Line (DSF), HER2-low and CDx, "
            "Clinical Trial Support sections"
        ),
        "target_roles": [
            "Business Development", "Oncology Lead",
            "Clinical Trial Manager", "R&D Director",
            "Medical Science Liaison", "Head of Companion Diagnostics",
            "Clinical Operations", "Biomarker Lead",
        ],
        "target_companies": [
            "AstraZeneca", "Daiichi Sankyo", "BioNTech", "Pfizer", "Gilead",
            "Roche", "Novartis", "Merck", "Bristol-Myers Squibb", "Lilly",
            "Sanofi", "Bayer", "Johnson & Johnson",
            "ICON", "Covance", "LabCorp", "Quest Diagnostics",
        ],
        "target_geos": [],  # Global — not geo-restricted
        "search_queries": [
            # Major pharma — AstraZeneca, Daiichi Sankyo (HER2 focus)
            'site:linkedin.com/in "Business Development" OR "Oncology Lead"'
            ' OR "Clinical Trial Manager" AstraZeneca OR "Daiichi Sankyo"'
            ' HER2 OR "digital pathology"',
            # Roche, Novartis, Pfizer
            'site:linkedin.com/in "Business Development" OR "Oncology"'
            ' OR "Diagnostics" Roche OR Novartis OR Pfizer'
            ' "companion diagnostic" OR "digital pathology"',
            # More pharma: Merck, BMS, Lilly, Gilead
            'site:linkedin.com/in "Oncology" OR "Clinical Development"'
            ' OR "Biomarker" Merck OR "Bristol-Myers" OR Lilly OR Gilead'
            ' pathology OR diagnostics',
            # BioNTech, Sanofi, Bayer, J&J
            'site:linkedin.com/in "Business Development" OR "R&D Director"'
            ' BioNTech OR Sanofi OR Bayer OR "Johnson & Johnson"'
            ' oncology OR CDx OR biomarker',
            # CDx / companion diagnostic specialists
            'site:linkedin.com/in "R&D Director" OR "Biomarker"'
            ' OR "Head of Companion Diagnostics" pharma oncology'
            ' "companion diagnostic" OR CDx',
            # MSL / clinical operations
            'site:linkedin.com/in "Medical Science Liaison"'
            ' OR "Clinical Operations" oncology pharma'
            ' "digital pathology" OR "AI diagnostics"',
            # CROs and diagnostic partners
            'site:linkedin.com/in "Clinical Trial" OR "Pathology Services"'
            ' OR "Central Lab" ICON OR Covance OR LabCorp OR "Quest Diagnostics"'
            ' oncology OR pathology',
            # LatAm pharma divisions
            'site:linkedin.com/in "Director Médico" OR "Medical Director"'
            ' OR "Clinical Research" pharma oncology'
            ' "Latin America" OR LATAM OR Argentina OR Brazil',
            # Digital pathology / AI companies (potential partners)
            'site:linkedin.com/in "Business Development" OR "Partnerships"'
            ' "digital pathology" OR "computational pathology"'
            ' OR "AI diagnostics" OR "precision medicine"',
        ],
        "selling_points": [
            "Objective HER2-low quantification (IHC 1+ and 2+/ISH-) — "
            "eliminates subjective manual scoring",
            "Biomarker standardization (Ki-67, HER2) across international "
            "trial sites",
            "Real-time trial pre-screening of H&E and IHC slides",
            "Real-World Data: de-identified WSI datasets with AI-generated "
            "spatial analytics",
            "Unique Global South datasets and regulatory relationships "
            "(LatAm + Africa) — where PathAI/Paige don't operate",
            "Clinical validation data from Granada projects",
            "Reference: DESTINY-Breast06 trial, Enhertu ADC",
        ],
        "scientific_context": {
            "HER2_low": (
                "New breast cancer classification. Patients with low/"
                "ultralow HER2 (IHC 1+ or 2+/ISH-) benefit from targeted "
                "ADCs like Enhertu."
            ),
            "CDx": (
                "If validated as Companion Diagnostic, Digpatho's use "
                "becomes legally required for drug prescription."
            ),
            "problem": (
                "Manual IHC scoring is subjective at low detection limits. "
                "Therapies cost $10,000+/month per patient — wrong "
                "classification is catastrophic."
            ),
            "key_trial": (
                "DESTINY-Breast06 proved efficacy of ADCs in HER2-low "
                "patients."
            ),
        },
        "email_tone": (
            "Scientific-strategic. Speak about clinical validation, "
            "regulatory data, drug development pipeline, emerging market "
            "access for trials."
        ),
        "email_cta": "30-minute technical briefing",
        "anti_patterns": [
            "NEVER mention $1,300/case savings, lab throughput, pathologist "
            "shortage, or SaaS pricing. Those are DIRECT_B2B arguments.",
        ],
    },

    # ------------------------------------------------------------------
    # VERTICAL 3: INFLUENCER
    # GTM: "Middle Ring: Targeting Blogs and Influencers",
    #       "Month 2: Inbound Content Engine", "Month 3: Regulatory PR"
    # ------------------------------------------------------------------
    "INFLUENCER": {
        "display_name": "Influencers & Thought Leadership",
        "gtm_source": (
            "Middle Ring: Targeting Blogs and Influencers, "
            "Month 2 Inbound Content Engine, Month 3 Regulatory PR"
        ),
        "target_roles": [
            "Editor", "Author", "Founder", "KOL", "Speaker",
            "Blogger", "Podcast Host", "Content Creator",
        ],
        "target_geos": [],  # Global
        "search_queries": [
            # Digital pathology editors & authors
            'site:linkedin.com/in "Editor" OR "Founder" OR "Author"'
            ' "digital pathology" OR "AI in healthcare"'
            ' OR "computational pathology"',
            # KOLs and speakers
            'site:linkedin.com/in "thought leader" OR "keynote speaker"'
            ' OR "blogger" pathology AI oncology diagnostics',
            # Podcast hosts & content creators
            'site:linkedin.com/in "podcast host" OR "content creator"'
            ' "digital health" OR "health tech" OR "medtech" pathology',
            # Journalists / health tech media
            'site:linkedin.com/in "journalist" OR "reporter" OR "editor"'
            ' "health tech" OR "medical technology" OR "digital health"'
            ' AI OR diagnostics',
            # Academic KOLs — professors and researchers
            'site:linkedin.com/in "Professor" OR "Researcher"'
            ' "computational pathology" OR "digital pathology"'
            ' OR "AI pathology" publications OR research',
            # Newsletter / Substack / publication authors
            'site:linkedin.com/in "newsletter" OR "Substack" OR "publication"'
            ' "pathology" OR "diagnostics" OR "precision medicine"'
            ' OR "healthcare AI"',
            # Health tech investors & advisors (influence multipliers)
            'site:linkedin.com/in "Venture" OR "Advisor" OR "Board Member"'
            ' "digital pathology" OR "health tech" OR "medtech"'
            ' oncology OR diagnostics',
            # Industry analysts
            'site:linkedin.com/in "Analyst" OR "Consultant"'
            ' "digital pathology" OR "precision medicine"'
            ' OR "AI healthcare" market OR trends',
        ],
        "content_offers": [
            "Guest post: 'The Clinical Impact of HER2-low' or "
            "'Solving Gleason Grading Variability'",
            "Exclusive interview: the Global South angle — AI solving "
            "pathology crisis in LatAm and Africa",
            "Case study: clinical validation data from Nigeria (UCH) "
            "and South Africa (Wits) pilots",
            "Leapfrogging narrative: Africa skipping traditional "
            "glass-slide pathology for AI telepathology",
            "Exclusive data: preliminary results, usage statistics, "
            "measured clinical impact",
        ],
        "email_tone": (
            "Collaborative, peer-to-peer. Don't sell product — offer "
            "exclusive knowledge and content partnership."
        ),
        "email_cta": "Content collaboration call",
        "anti_patterns": [
            "NEVER pitch the product, mention pricing, or ask them to "
            "try Digpatho. Goal is relationship and visibility.",
        ],
    },

    # ------------------------------------------------------------------
    # VERTICAL 4: EVENTS
    # GTM: "Middle Ring: Trade Shows and Conferences",
    #       "Week 8: Webinar Hook", "Month 4: Scaling"
    # ------------------------------------------------------------------
    "EVENTS": {
        "display_name": "Events & Conferences",
        "gtm_source": (
            "Middle Ring: Trade Shows and Conferences, "
            "Week 8 Webinar Hook, Month 4 Scaling"
        ),
        "target_roles": [
            "Speaker", "Organizer", "Chair", "Panelist",
            "Program Director", "Scientific Committee",
        ],
        "reference_events": [
            "USCAP", "FIFARMA", "European Congress of Pathology",
            "Digital Pathology Congress",
            "African Union AI conferences", "Inniches",
        ],
        "target_geos": [],  # Global
        "search_queries": [
            # USCAP (biggest pathology conference)
            'site:linkedin.com/in "Speaker" OR "Organizer" OR "Chair"'
            ' "pathology congress" OR "oncology symposium"'
            ' OR "USCAP" 2025 OR 2026',
            # European Congress of Pathology (ECP)
            'site:linkedin.com/in "Speaker" OR "Panelist"'
            ' "European Congress of Pathology" OR "ECP" OR "ESP"'
            ' pathology 2025 OR 2026',
            # Digital Pathology & AI conferences
            'site:linkedin.com/in "Program Director"'
            ' OR "Scientific Committee" "digital pathology"'
            ' OR "pathology conference"',
            'site:linkedin.com/in "Speaker" OR "Organizer"'
            ' "Digital Pathology" OR "Computational Pathology"'
            ' OR "PathVisions" conference OR congress',
            # FIFARMA + LatAm conferences
            'site:linkedin.com/in "Speaker" OR "Panelist"'
            ' "FIFARMA" OR "digital pathology congress"'
            ' OR "SLAPC" OR "congreso patología"',
            # African conferences + AU AI
            'site:linkedin.com/in "Speaker" OR "Organizer" OR "Chair"'
            ' "African" OR "Africa" pathology OR diagnostics'
            ' conference OR congress OR symposium',
            # Oncology summits
            'site:linkedin.com/in "Speaker" OR "Chair" OR "Moderator"'
            ' "oncology summit" OR "ASCO" OR "ESMO" OR "AACR"'
            ' "digital pathology" OR biomarker OR diagnostics',
            # Medtech / health tech conferences
            'site:linkedin.com/in "Speaker" OR "Panelist"'
            ' "medtech" OR "health tech" OR "HIMSS"'
            ' AI OR "machine learning" diagnostics OR pathology',
        ],
        "selling_points": [
            "Live demo: 95% accuracy demonstrable on the spot",
            "Pre-scheduled 1-on-1 meeting (15 min) during the event",
            "Joint presentation, poster, or workshop proposal",
            "Sponsorship or presentation slot proposal (for organizers)",
        ],
        "email_tone": (
            "Direct, concise, 5-7 lines max. One concrete meeting proposal."
        ),
        "email_cta": "15-minute meeting at [EVENT]",
        "anti_patterns": [
            "NEVER send long emails. No extensive product pitch. "
            "No pricing. One concrete meeting proposal only.",
        ],
    },
}


# ============================================================================
# EMAIL_TEMPLATES — Vertical × Language
# ============================================================================
# Each vertical has 2+ subject/body template variants per language.
# Placeholders: {name}, {company}, {job_title}, {event}
# Missing data uses visible placeholders: [NOMBRE], [EMPRESA], etc.

EMAIL_TEMPLATES: Dict[str, Dict[str, List[Dict[str, Any]]]] = {

    # ------------------------------------------------------------------
    # DIRECT_B2B templates
    # GTM: "Service Business Line" — ROI-driven, operational tone
    # ------------------------------------------------------------------
    "DIRECT_B2B": {
        "en": [
            {
                "subject": "Reducing diagnostic turnaround at {company}",
                "body": (
                    "Dear {name},\n\n"
                    "The global shortage of pathologists — estimated at "
                    "40,000 worldwide — continues to strain diagnostic labs. "
                    "With caseloads growing and turnaround expectations "
                    "tightening, the throughput challenge is real.\n\n"
                    "At Digpatho, we've developed an AI-powered cell analysis "
                    "platform that processes microscopic images 5-10x faster "
                    "than manual microscopy, achieving 95% diagnostic "
                    "accuracy. Our SaaS model means no upfront investment in "
                    "scanners or IT infrastructure — it works on any device, "
                    "even without high-speed internet.\n\n"
                    "We're running active pilots at reference centers "
                    "including Instituto Oulton (Argentina) and University "
                    "College Hospital (Nigeria), delivering $1,300 USD in "
                    "savings per case and a 28% reduction in diagnostic "
                    "turnaround time.\n\n"
                    "I'd welcome 15 minutes to show you how this could "
                    "work for {company}. Would you be open to a brief demo?\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
            {
                "subject": "5-10x faster slide analysis — built for labs like {company}",
                "body": (
                    "Dear {name},\n\n"
                    "I'm reaching out because labs managing high diagnostic "
                    "volumes face a difficult trade-off: speed vs. accuracy. "
                    "We built Digpatho specifically to solve this.\n\n"
                    "Our AI platform automates cell analysis for biomarkers "
                    "(HER2, Ki-67, ER, PR) with 95% accuracy, processing "
                    "slides 5-10x faster than manual microscopy. The SaaS "
                    "model eliminates the typical $50K-$300K upfront cost "
                    "of digital pathology infrastructure.\n\n"
                    "Active pilots at Hospital de Ezeiza and Wits University "
                    "(South Africa) show consistent results: $1,300 savings "
                    "per case and inter-observer variability eliminated.\n\n"
                    "Could we schedule a 15-minute demo to explore how "
                    "this fits {company}'s workflow?\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
        "es": [
            {
                "subject": "Reducir el tiempo diagnóstico un 28% en {company}",
                "body": (
                    "Estimado/a {name},\n\n"
                    "La escasez global de patólogos — estimada en 40,000 "
                    "a nivel mundial — sigue presionando a laboratorios "
                    "diagnósticos. Con volúmenes crecientes y expectativas "
                    "de turnaround cada vez más exigentes, el desafío de "
                    "productividad es real.\n\n"
                    "En Digpatho desarrollamos una plataforma de análisis "
                    "celular con IA que procesa imágenes microscópicas "
                    "5-10x más rápido que la microscopía manual, con 95% "
                    "de precisión diagnóstica. Nuestro modelo SaaS elimina "
                    "la inversión inicial de $50K-$300K en escáneres e "
                    "infraestructura IT — funciona en cualquier dispositivo, "
                    "incluso sin internet de alta velocidad.\n\n"
                    "Tenemos pilotos activos en centros de referencia como "
                    "Instituto Oulton (Córdoba) y Hospital de Ezeiza, con "
                    "resultados medibles: ahorro de $1,300 USD por caso y "
                    "reducción del 28% en tiempo diagnóstico.\n\n"
                    "Me encantaría dedicarle 15 minutos para una demo "
                    "adaptada al flujo de trabajo de {company}. "
                    "¿Le funcionaría la próxima semana?\n\n"
                    "Cordialmente,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
            {
                "subject": "Análisis de slides 5-10x más rápido para {company}",
                "body": (
                    "Estimado/a {name},\n\n"
                    "Le escribo porque los laboratorios que manejan altos "
                    "volúmenes diagnósticos enfrentan un trade-off difícil: "
                    "velocidad vs. precisión. Digpatho se diseñó "
                    "específicamente para resolver esto.\n\n"
                    "Nuestra plataforma de IA automatiza el análisis celular "
                    "de biomarcadores (HER2, Ki-67, RE, RP) con 95% de "
                    "precisión, procesando slides 5-10x más rápido que la "
                    "microscopía manual. El modelo SaaS elimina el costo "
                    "típico de $50K-$300K de infraestructura de patología "
                    "digital.\n\n"
                    "Pilotos activos en Hospital de Ezeiza e Instituto Oulton "
                    "muestran resultados consistentes: $1,300 USD de ahorro "
                    "por caso y eliminación de la variabilidad "
                    "inter-observador.\n\n"
                    "¿Podríamos agendar una demo de 15 minutos para explorar "
                    "cómo se integra al flujo de {company}?\n\n"
                    "Cordialmente,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
        "pt": [
            {
                "subject": "Reduzir o tempo diagnóstico em 28% no {company}",
                "body": (
                    "Prezado/a {name},\n\n"
                    "A escassez global de patologistas — estimada em 40.000 "
                    "mundialmente — continua pressionando laboratórios "
                    "diagnósticos. Com volumes crescentes e expectativas de "
                    "prazo cada vez mais apertadas, o desafio de "
                    "produtividade é real.\n\n"
                    "Na Digpatho, desenvolvemos uma plataforma de análise "
                    "celular com IA que processa imagens microscópicas "
                    "5-10x mais rápido que a microscopia manual, com 95% "
                    "de precisão diagnóstica. Nosso modelo SaaS elimina o "
                    "investimento inicial de $50K-$300K em scanners e "
                    "infraestrutura de TI — funciona em qualquer "
                    "dispositivo, mesmo sem internet de alta velocidade.\n\n"
                    "Temos pilotos ativos em centros de referência como "
                    "Instituto Oulton (Argentina) e University College "
                    "Hospital (Nigéria), com resultados mensuráveis: "
                    "economia de $1.300 USD por caso e redução de 28% no "
                    "tempo diagnóstico.\n\n"
                    "Gostaria de dedicar 15 minutos para uma demo adaptada "
                    "ao fluxo de trabalho do {company}. Teria "
                    "disponibilidade na próxima semana?\n\n"
                    "Atenciosamente,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
    },

    # ------------------------------------------------------------------
    # PHARMA templates
    # GTM: "Pharma Business Line (DSF)" — Scientific-strategic tone
    # ------------------------------------------------------------------
    "PHARMA": {
        "en": [
            {
                "subject": "HER2-low quantification — eliminating IHC scoring subjectivity",
                "body": (
                    "Dear {name},\n\n"
                    "The DESTINY-Breast06 results have expanded the clinical "
                    "relevance of HER2-low (IHC 1+ and 2+/ISH-) "
                    "classification, opening ADC therapies like Enhertu to "
                    "a broader patient population. However, manual IHC "
                    "scoring at these low detection thresholds remains "
                    "notoriously subjective — a critical gap when therapies "
                    "cost $10,000+/month per patient.\n\n"
                    "At Digpatho, we've developed AI-powered quantification "
                    "that provides objective, reproducible HER2-low scoring "
                    "across sites. Our platform standardizes biomarker "
                    "assessment (Ki-67, HER2) for multi-site clinical trials, "
                    "with real-time pre-screening of H&E and IHC slides.\n\n"
                    "What makes our position unique: we operate validated "
                    "pilots across Latin America and Africa — territories "
                    "where PathAI and Paige have no presence. This gives "
                    "us access to Global South datasets and regulatory "
                    "relationships that are valuable for expanding trial "
                    "enrollment to emerging markets.\n\n"
                    "We also offer de-identified Whole Slide Image datasets "
                    "enriched with AI-generated spatial analytics for R&D "
                    "teams.\n\n"
                    "I'd welcome a 30-minute technical briefing to discuss "
                    "how this aligns with {company}'s CDx or clinical trial "
                    "strategy. Would that be of interest?\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
            {
                "subject": "Global South trial data for {company}'s CDx pipeline",
                "body": (
                    "Dear {name},\n\n"
                    "As the HER2-low classification reshapes treatment "
                    "algorithms following DESTINY-Breast06, the demand for "
                    "standardized companion diagnostic tools is growing — "
                    "particularly for multi-site international trials.\n\n"
                    "Digpatho offers AI-powered biomarker quantification "
                    "that eliminates the inter-observer variability inherent "
                    "in manual IHC scoring at low detection limits (IHC 1+, "
                    "2+/ISH-). Our platform supports trial pre-screening, "
                    "biomarker standardization across sites, and generates "
                    "Real-World Data from de-identified WSI datasets.\n\n"
                    "Our differentiator: validated operations in Latin "
                    "America (Argentina, Brazil) and Africa (Nigeria, South "
                    "Africa) — providing access to diverse patient "
                    "populations and regulatory pathways that the major "
                    "digital pathology players don't cover.\n\n"
                    "Clinical validation data from our Granada partnership "
                    "and active pilots support our CDx pathway.\n\n"
                    "Could we schedule a 30-minute technical briefing to "
                    "explore potential alignment with {company}'s oncology "
                    "pipeline?\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
        "es": [
            {
                "subject": "Cuantificación HER2-low — eliminando la subjetividad del scoring IHC",
                "body": (
                    "Estimado/a {name},\n\n"
                    "Los resultados de DESTINY-Breast06 han expandido la "
                    "relevancia clínica de la clasificación HER2-low "
                    "(IHC 1+ y 2+/ISH-), abriendo terapias ADC como "
                    "Enhertu a una población más amplia de pacientes. Sin "
                    "embargo, el scoring manual de IHC en estos umbrales "
                    "bajos de detección sigue siendo notoriamente "
                    "subjetivo — una brecha crítica cuando las terapias "
                    "cuestan $10,000+/mes por paciente.\n\n"
                    "En Digpatho, desarrollamos cuantificación con IA que "
                    "proporciona scoring HER2-low objetivo y reproducible "
                    "entre sitios. Nuestra plataforma estandariza la "
                    "evaluación de biomarcadores (Ki-67, HER2) para "
                    "ensayos clínicos multi-sitio, con pre-screening en "
                    "tiempo real de slides H&E e IHC.\n\n"
                    "Nuestra posición única: operamos pilotos validados en "
                    "América Latina y África — territorios donde PathAI y "
                    "Paige no tienen presencia. Esto nos da acceso a "
                    "datasets del Global South y relaciones regulatorias "
                    "valiosas para expandir el enrollment de ensayos a "
                    "mercados emergentes.\n\n"
                    "También ofrecemos datasets de Whole Slide Images "
                    "de-identificados, enriquecidos con analítica espacial "
                    "generada por IA, para equipos de R&D.\n\n"
                    "Me encantaría coordinar un briefing técnico de 30 "
                    "minutos para discutir cómo esto se alinea con la "
                    "estrategia de CDx o ensayos clínicos de {company}. "
                    "¿Le interesaría?\n\n"
                    "Cordialmente,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
    },

    # ------------------------------------------------------------------
    # INFLUENCER templates
    # GTM: "Targeting Blogs and Influencers" — Collaborative, peer tone
    # ------------------------------------------------------------------
    "INFLUENCER": {
        "en": [
            {
                "subject": "Content collaboration — AI pathology in the Global South",
                "body": (
                    "Dear {name},\n\n"
                    "I've been following your work in the digital pathology "
                    "space and wanted to reach out about a potential content "
                    "collaboration.\n\n"
                    "We're working on AI-powered cell analysis for pathology "
                    "labs across Latin America and Africa — a story that "
                    "doesn't get enough coverage. We have active pilots at "
                    "University College Hospital (Nigeria) and Wits "
                    "University (South Africa) with preliminary clinical "
                    "impact data we'd be happy to share.\n\n"
                    "Would you be interested in any of these angles?\n"
                    "- Guest post on 'AI pathology adoption in the "
                    "Global South'\n"
                    "- Case study with clinical validation data from our "
                    "African pilots\n"
                    "- The 'leapfrogging' story: Africa going from glass "
                    "slides directly to AI-powered telepathology\n\n"
                    "Happy to jump on a call to discuss what would work "
                    "best for your audience.\n\n"
                    "Best,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
            {
                "subject": "Exclusive data — Gleason grading variability solved with AI",
                "body": (
                    "Dear {name},\n\n"
                    "Your coverage of computational pathology caught my "
                    "attention — specifically your perspective on "
                    "standardization challenges.\n\n"
                    "We have some compelling data on two fronts:\n"
                    "1. Solving Gleason grading variability with AI — one "
                    "of uropatology's biggest challenges\n"
                    "2. How HER2-low reclassification is driving demand "
                    "for objective IHC quantification\n\n"
                    "We're happy to share preliminary results, usage "
                    "statistics, and measured clinical impact from our "
                    "pilots for a guest post or interview — whichever "
                    "format works best for you.\n\n"
                    "Would a brief content collaboration call make sense?\n\n"
                    "Best,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
        "es": [
            {
                "subject": "Colaboración de contenido — IA en patología del Global South",
                "body": (
                    "Estimado/a {name},\n\n"
                    "He seguido su trabajo en el espacio de patología "
                    "digital y quería contactarle sobre una posible "
                    "colaboración de contenido.\n\n"
                    "Estamos trabajando con análisis celular con IA en "
                    "laboratorios de patología en América Latina y "
                    "África — una historia que no recibe suficiente "
                    "cobertura. Tenemos pilotos activos en University "
                    "College Hospital (Nigeria) y Wits University "
                    "(Sudáfrica) con datos preliminares de impacto "
                    "clínico que podemos compartir.\n\n"
                    "¿Le interesaría alguno de estos ángulos?\n"
                    "- Guest post sobre 'Adopción de IA en patología "
                    "del Global South'\n"
                    "- Caso de estudio con datos de validación clínica "
                    "de nuestros pilotos en África\n"
                    "- La narrativa del 'leapfrogging': África saltando "
                    "de portaobjetos a telepatología con IA\n\n"
                    "Con gusto agendamos una llamada para ver qué "
                    "funciona mejor para su audiencia.\n\n"
                    "Saludos,\n"
                    "[SENDER_NAME]\n"
                    "Digpatho IA"
                ),
            },
        ],
    },

    # ------------------------------------------------------------------
    # EVENTS templates
    # GTM: "Trade Shows and Conferences" — Direct, 4-6 lines max
    # ------------------------------------------------------------------
    "EVENTS": {
        "en": [
            {
                "subject": "[EVENT] — 15-minute meeting request",
                "body": (
                    "Dear {name},\n\n"
                    "I'll be attending [EVENT] and noticed your "
                    "involvement. I'd love to schedule a brief 15-minute "
                    "meeting — we can demonstrate our AI cell analysis "
                    "platform (95% diagnostic accuracy) live on the spot.\n\n"
                    "Would [DATE/TIME] work for you?\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME] — Digpatho IA"
                ),
            },
            {
                "subject": "[EVENT] — joint presentation proposal",
                "body": (
                    "Dear {name},\n\n"
                    "I saw you're presenting at [EVENT]. We're running "
                    "AI pathology pilots in LatAm and Africa with "
                    "compelling clinical data — would you be open to "
                    "discussing a joint poster or workshop?\n\n"
                    "Happy to meet briefly at the event to explore this.\n\n"
                    "Best regards,\n"
                    "[SENDER_NAME] — Digpatho IA"
                ),
            },
        ],
        "es": [
            {
                "subject": "[EVENT] — solicitud de reunión de 15 minutos",
                "body": (
                    "Estimado/a {name},\n\n"
                    "Estaré en [EVENT] y noté su participación. Me "
                    "encantaría agendar una reunión de 15 minutos — "
                    "podemos hacer una demo en vivo de nuestra plataforma "
                    "de análisis celular con IA (95% de precisión).\n\n"
                    "¿Le funcionaría [FECHA/HORA]?\n\n"
                    "Cordialmente,\n"
                    "[SENDER_NAME] — Digpatho IA"
                ),
            },
            {
                "subject": "[EVENT] — propuesta de presentación conjunta",
                "body": (
                    "Estimado/a {name},\n\n"
                    "Vi que presenta en [EVENT]. Tenemos pilotos de IA "
                    "en patología en LatAm y África con datos clínicos "
                    "interesantes — ¿estaría abierto/a a explorar un "
                    "poster o workshop conjunto?\n\n"
                    "Podemos reunirnos brevemente durante el evento.\n\n"
                    "Cordialmente,\n"
                    "[SENDER_NAME] — Digpatho IA"
                ),
            },
        ],
    },
}


# ============================================================================
# Helper functions
# ============================================================================

def _load_env() -> None:
    """Load environment variables from .env.local or .env."""
    if load_dotenv is None:
        logger.warning(
            "python-dotenv not installed. Using OS environment variables only."
        )
        return
    # Try .env.local first (matches existing project pattern), then .env
    project_root = os.path.dirname(os.path.abspath(__file__))
    for env_file in [".env.local", ".env"]:
        path = os.path.join(project_root, env_file)
        if os.path.exists(path):
            load_dotenv(path)
            logger.info("Loaded environment from %s", env_file)
            return
    logger.warning("No .env.local or .env file found. Using OS env vars.")


def _get_supabase_client() -> Any:
    """Create a Supabase client using the project's connection pattern."""
    if create_client is None:
        logger.error(
            "supabase package not installed. "
            "Run: pip install -r requirements_growth.txt"
        )
        sys.exit(1)

    # Support both VITE_-prefixed (frontend) and plain (backend) vars
    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("VITE_SUPABASE_URL")
    )
    # Prefer service key for backend scripts (bypasses RLS)
    key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        logger.error(
            "Missing Supabase credentials. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) in your environment."
        )
        sys.exit(1)

    return create_client(url, key)


def parse_linkedin_url(url: str) -> Optional[str]:
    """Extract the LinkedIn profile slug from a URL."""
    match = re.search(r"linkedin\.com/in/([^/?#]+)", url)
    return match.group(1).rstrip("/") if match else None


def _clean_truncated(text: Optional[str]) -> Optional[str]:
    """Remove trailing ellipsis left by Google's title truncation."""
    if not text:
        return text
    return re.sub(r"\s*\.{2,}\s*$", "", text).rstrip("…").strip() or None


def parse_linkedin_title(title: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse a LinkedIn search result title into (name, job_title, company).

    Typical format: "John Doe - Chief of Pathology - Hospital XYZ | LinkedIn"
    """
    if not title:
        return None, None, None

    # Remove " | LinkedIn" suffix
    title = re.sub(r"\s*[|–—]\s*LinkedIn\s*$", "", title, flags=re.IGNORECASE)
    # Split by common separators
    parts = [p.strip() for p in re.split(r"\s*[-–—]\s*", title) if p.strip()]

    name = _clean_truncated(parts[0]) if len(parts) > 0 else None
    job_title = _clean_truncated(parts[1]) if len(parts) > 1 else None
    company = _clean_truncated(parts[2]) if len(parts) > 2 else None

    # If there are >3 parts, the middle ones are likely all part of the job title
    # e.g. "Name - Senior Director - Digital Pathology - Company | LinkedIn"
    if len(parts) > 3:
        job_title = _clean_truncated(" - ".join(parts[1:-1]))
        company = _clean_truncated(parts[-1])

    return name, job_title, company


def infer_name_from_slug(slug: str) -> str:
    """Infer a human name from a LinkedIn URL slug."""
    # Remove trailing numeric IDs (e.g., "john-doe-12345ab")
    parts = slug.split("-")
    name_parts = []
    for part in parts:
        # Skip parts that look like LinkedIn's random ID suffixes
        if re.match(r"^[0-9a-f]{5,}$", part):
            continue
        if part.isdigit():
            continue
        name_parts.append(part.capitalize())

    return " ".join(name_parts) if name_parts else slug


def infer_geo_from_query(query: str) -> Optional[str]:
    """Infer geographic region from the search query used."""
    geo_keywords = {
        "Argentina": "Argentina",
        "Brazil": "Brazil",
        "Brasil": "Brazil",
        "South Africa": "South Africa",
        "Nigeria": "Nigeria",
        "Paraguay": "Paraguay",
        "Uruguay": "Uruguay",
        "Bolivia": "Bolivia",
        "Peru": "Peru",
        "Colombia": "Colombia",
        "México": "Mexico",
        "Mexico": "Mexico",
        "Chile": "Chile",
        "Kenya": "Kenya",
        "Ghana": "Ghana",
        "Ethiopia": "Ethiopia",
        "Tanzania": "Tanzania",
        "West Africa": "West Africa",
        "LATAM": "Latin America",
        "Latin America": "Latin America",
    }
    for keyword, geo in geo_keywords.items():
        if keyword.lower() in query.lower():
            return geo
    return None


def extract_emails_from_text(text: str) -> List[str]:
    """Extract email addresses from a text string (search snippet, title, etc.)."""
    if not text:
        return []
    # Standard email regex — catches most valid emails
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    emails = re.findall(pattern, text)
    # Filter out obvious junk (image files, example domains, etc.)
    blocked_domains = {"example.com", "email.com", "test.com", "sentry.io", "linkedin.com"}
    blocked_extensions = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
    clean = []
    for email in emails:
        email_lower = email.lower()
        domain = email_lower.split("@")[1] if "@" in email_lower else ""
        if domain in blocked_domains:
            continue
        if any(email_lower.endswith(ext) for ext in blocked_extensions):
            continue
        clean.append(email_lower)
    return list(set(clean))


def build_email_search_queries(name: str, company: Optional[str]) -> List[str]:
    """
    Build Google Dorking queries to find a person's email address.

    Uses name + company to search for publicly available email addresses
    on institutional pages, conference programs, publications, etc.
    """
    queries = []
    if not name or name in ("[NOMBRE]", ""):
        return queries

    # Clean name for search
    clean_name = name.strip().strip('"')

    # Query 1: Direct email search with name
    queries.append(f'"{clean_name}" email OR correo OR mailto')

    # Query 2: Name + company + email pattern
    if company and company not in ("[EMPRESA]", ""):
        clean_company = company.strip().strip('"')
        queries.append(f'"{clean_name}" "{clean_company}" email OR @')

    # Query 3: Search in academic/institutional contexts
    queries.append(f'"{clean_name}" pathology OR patología "@" site:researchgate.net OR site:scholar.google.com OR site:orcid.org')

    return queries


def determine_language(geo: Optional[str]) -> str:
    """Determine email language based on lead geography."""
    if not geo:
        return "en"
    geo_lower = geo.lower()
    if "brazil" in geo_lower or "brasil" in geo_lower:
        return "pt"
    latam_es = [
        "argentina", "paraguay", "uruguay", "bolivia", "peru",
        "mexico", "colombia", "chile", "ecuador", "venezuela",
        "costa rica", "panama", "guatemala",
    ]
    for country in latam_es:
        if country in geo_lower:
            return "es"
    return "en"


# ============================================================================
# Agent 1: SafeSearcher
# ============================================================================
# GTM: Implements the Google Dorking search patterns from each vertical
# in the Bull's-eye framework.

class SafeSearcher:
    """
    Searches for LinkedIn prospects via Google Dorking by vertical.

    Uses googlesearch-python to find LinkedIn profile URLs matching
    the target roles and geographies defined in VERTICAL_CONFIGS.

    Rate limiting: 10-20s random interval between searches.
    Max searches per run: configurable (default 20).
    HTTP 429 handling: exponential backoff (30s, 60s, 120s), max 3 retries.
    """

    # Rate limiting constants
    MIN_DELAY_SECONDS = 10
    MAX_DELAY_SECONDS = 20
    BACKOFF_BASE_SECONDS = 30
    MAX_RETRIES = 3
    RESULTS_PER_QUERY = 10

    def __init__(self, max_searches: int = 20):
        if google_search is None:
            logger.error(
                "googlesearch-python not installed. "
                "Run: pip install -r requirements_growth.txt"
            )
            sys.exit(1)

        self.max_searches = max_searches
        self.searches_done = 0
        self.results: List[Dict[str, Any]] = []

    def search_vertical(self, vertical: str) -> List[Dict[str, Any]]:
        """
        Execute all search queries for a given vertical.

        Returns a list of raw lead dicts with keys:
            full_name, job_title, company, linkedin_url, vertical,
            source_query, geo
        """
        config = VERTICAL_CONFIGS.get(vertical)
        if not config:
            logger.error("Unknown vertical: %s", vertical)
            return []

        queries = config["search_queries"]
        leads_found: List[Dict[str, Any]] = []

        for query in queries:
            if self.searches_done >= self.max_searches:
                logger.warning(
                    "Reached max searches limit (%d). Stopping.",
                    self.max_searches,
                )
                break

            logger.info(
                "[SafeSearcher] Executing query %d/%d for %s: %.80s...",
                self.searches_done + 1,
                self.max_searches,
                vertical,
                query,
            )

            results = self._execute_search(query)
            self.searches_done += 1

            for result in results:
                url = result.get("url", "")
                if "linkedin.com/in/" not in url:
                    continue

                slug = parse_linkedin_url(url)
                if not slug:
                    continue

                # Parse name/title/company from search result title
                title = result.get("title", "")
                name, job_title, company = parse_linkedin_title(title)

                # Fallback: infer name from URL slug
                if not name:
                    name = infer_name_from_slug(slug)

                geo = infer_geo_from_query(query)

                # Try to extract email from search snippet/description
                snippet = result.get("description", "")
                found_emails = extract_emails_from_text(
                    f"{title} {snippet}"
                )

                # Try to get fuller job title / company from snippet
                # when the Google title was truncated
                if snippet and job_title:
                    # Snippets often start with the full title text
                    snippet_lower = snippet.lower()
                    jt_lower = job_title.lower()
                    if jt_lower in snippet_lower:
                        idx = snippet_lower.index(jt_lower)
                        # Extract longer version up to next sentence boundary
                        rest = snippet[idx:]
                        match = re.match(r"^([^.·|]+)", rest)
                        if match:
                            fuller = _clean_truncated(match.group(1).strip())
                            if fuller and len(fuller) > len(job_title):
                                job_title = fuller

                lead = {
                    "full_name": name,
                    "job_title": job_title,
                    "company": company,
                    "email": found_emails[0] if found_emails else None,
                    "linkedin_url": f"https://www.linkedin.com/in/{slug}",
                    "vertical": vertical,
                    "source_query": query,
                    "geo": geo,
                    "description": snippet,
                }
                leads_found.append(lead)
                logger.info(
                    "[SafeSearcher] Found: %s — %s at %s (%s)",
                    name, job_title or "?", company or "?", url,
                )

            logger.info(
                "[SafeSearcher] Query returned %d LinkedIn profiles",
                len([r for r in results if "linkedin.com/in/" in r.get("url", "")]),
            )

            # Rate limiting between searches
            if self.searches_done < self.max_searches:
                delay = random.uniform(
                    self.MIN_DELAY_SECONDS, self.MAX_DELAY_SECONDS
                )
                logger.info(
                    "[SafeSearcher] Rate limit: waiting %.1fs before next query",
                    delay,
                )
                time.sleep(delay)

        logger.info(
            "[SafeSearcher] Vertical %s complete: %d leads found from %d searches",
            vertical, len(leads_found), self.searches_done,
        )
        self.results.extend(leads_found)
        return leads_found

    def search_email_for_lead(
        self, name: str, company: Optional[str] = None
    ) -> Optional[str]:
        """
        Try to find an email for a person via Google Dorking.

        Runs targeted email-finding queries and returns the first
        email found, or None if nothing found.
        """
        queries = build_email_search_queries(name, company)
        if not queries:
            return None

        for query in queries:
            if self.searches_done >= self.max_searches:
                break

            logger.info(
                "[SafeSearcher] Email search for '%s': %.80s...",
                name, query,
            )
            results = self._execute_search(query)
            self.searches_done += 1

            # Extract emails from all results
            for result in results:
                text = f"{result.get('title', '')} {result.get('description', '')}"
                emails = extract_emails_from_text(text)
                if emails:
                    logger.info(
                        "[SafeSearcher] Found email for %s: %s",
                        name, emails[0],
                    )
                    return emails[0]

            # Rate limit
            if self.searches_done < self.max_searches:
                delay = random.uniform(
                    self.MIN_DELAY_SECONDS, self.MAX_DELAY_SECONDS
                )
                time.sleep(delay)

        return None

    def search_all_verticals(self) -> List[Dict[str, Any]]:
        """Execute searches across all verticals."""
        all_leads: List[Dict[str, Any]] = []
        for vertical in VERTICAL_CONFIGS:
            if self.searches_done >= self.max_searches:
                break
            leads = self.search_vertical(vertical)
            all_leads.extend(leads)
        return all_leads

    def _execute_search(self, query: str) -> List[Dict[str, str]]:
        """
        Execute a single Google search with retry/backoff on HTTP 429.

        Returns list of dicts with 'url', 'title', 'description'.
        """
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                results = []
                # Use advanced=True to get title + description
                for item in google_search(
                    query,
                    num_results=self.RESULTS_PER_QUERY,
                    advanced=True,
                    sleep_interval=0,
                ):
                    results.append({
                        "url": getattr(item, "url", str(item)),
                        "title": getattr(item, "title", ""),
                        "description": getattr(item, "description", ""),
                    })
                return results

            except Exception as exc:
                exc_str = str(exc).lower()
                is_rate_limit = "429" in exc_str or "too many" in exc_str

                if is_rate_limit and attempt < self.MAX_RETRIES:
                    backoff = self.BACKOFF_BASE_SECONDS * (2 ** attempt)
                    logger.warning(
                        "[SafeSearcher] HTTP 429 — backing off %ds "
                        "(attempt %d/%d)",
                        backoff, attempt + 1, self.MAX_RETRIES,
                    )
                    time.sleep(backoff)
                else:
                    logger.error(
                        "[SafeSearcher] Search failed: %s", exc,
                    )
                    return []

        return []


# ============================================================================
# Agent 2: LeadManager
# ============================================================================
# GTM: Manages the prospect pipeline from raw discovery to DB insertion.

class LeadManager:
    """
    Validates, deduplicates, and inserts leads into Supabase.

    Dedup is based on linkedin_url (unique constraint in DB).
    Tags each lead with its vertical from VERTICAL_CONFIGS.
    """

    def __init__(self, supabase_client: Any, dry_run: bool = False):
        self.db = supabase_client
        self.dry_run = dry_run
        self.stats = {
            "processed": 0,
            "inserted": 0,
            "duplicates": 0,
            "errors": 0,
        }

    def process_leads(self, raw_leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process a batch of raw leads from SafeSearcher.

        Returns list of successfully inserted lead records.
        """
        inserted = []

        for lead in raw_leads:
            self.stats["processed"] += 1
            linkedin_url = lead.get("linkedin_url", "").strip()

            if not linkedin_url:
                logger.warning("[LeadManager] Skipping lead with empty LinkedIn URL")
                self.stats["errors"] += 1
                continue

            if not self._is_valid_linkedin_url(linkedin_url):
                logger.warning(
                    "[LeadManager] Invalid LinkedIn URL: %s", linkedin_url
                )
                self.stats["errors"] += 1
                continue

            # Check for existing lead in growth_leads (dedup by LinkedIn URL)
            if self._lead_exists(linkedin_url):
                logger.debug(
                    "[LeadManager] Duplicate skipped (growth_leads): %s", linkedin_url
                )
                self.stats["duplicates"] += 1
                continue

            # Check if this person already exists in the CRM contacts table
            full_name = lead.get("full_name", "")
            email = lead.get("email")
            if self._contact_exists(full_name, email):
                logger.info(
                    "[LeadManager] Already in CRM contacts, skipping: %s (%s)",
                    full_name, email or "no email",
                )
                self.stats["duplicates"] += 1
                continue

            # Split full_name into first/last
            first_name, last_name = self._split_name(
                lead.get("full_name", "")
            )

            record = {
                "full_name": lead.get("full_name"),
                "first_name": first_name,
                "last_name": last_name,
                "job_title": lead.get("job_title"),
                "company": lead.get("company"),
                "email": lead.get("email"),
                "linkedin_url": linkedin_url,
                "vertical": lead.get("vertical", "DIRECT_B2B"),
                "source_query": lead.get("source_query"),
                "geo": lead.get("geo"),
                "status": "new",
                "extra_data": {"description": lead.get("description", "")},
            }

            if self.dry_run:
                logger.info(
                    "[LeadManager][DRY-RUN] Would insert: %s (%s) — %s",
                    record["full_name"],
                    record["vertical"],
                    record["linkedin_url"],
                )
                self.stats["inserted"] += 1
                inserted.append(record)
                continue

            try:
                result = (
                    self.db.table("growth_leads")
                    .insert(record)
                    .execute()
                )
                if result.data:
                    inserted.append(result.data[0])
                    self.stats["inserted"] += 1
                    logger.info(
                        "[LeadManager] Inserted: %s (%s)",
                        record["full_name"], record["vertical"],
                    )
                else:
                    self.stats["errors"] += 1
                    logger.error(
                        "[LeadManager] Insert returned no data for: %s",
                        record["linkedin_url"],
                    )
            except Exception as exc:
                # Handle unique constraint violation as duplicate
                exc_str = str(exc).lower()
                if "duplicate" in exc_str or "unique" in exc_str:
                    self.stats["duplicates"] += 1
                    logger.debug(
                        "[LeadManager] Duplicate (DB constraint): %s",
                        linkedin_url,
                    )
                else:
                    self.stats["errors"] += 1
                    logger.error(
                        "[LeadManager] DB insert error for %s: %s",
                        linkedin_url, exc,
                    )

        self._log_stats()
        return inserted

    def get_leads_without_drafts(
        self, vertical: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch leads with status='new' (no draft generated yet)."""
        try:
            query = (
                self.db.table("growth_leads")
                .select("*")
                .eq("status", "new")
            )
            if vertical:
                query = query.eq("vertical", vertical)

            result = query.order("created_at", desc=False).execute()
            return result.data or []
        except Exception as exc:
            logger.error("[LeadManager] Error fetching leads: %s", exc)
            return []

    def update_lead_status(self, lead_id: str, status: str) -> None:
        """Update the status of a lead."""
        if self.dry_run:
            logger.info(
                "[LeadManager][DRY-RUN] Would update lead %s → %s",
                lead_id, status,
            )
            return
        try:
            self.db.table("growth_leads").update(
                {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", lead_id).execute()
        except Exception as exc:
            logger.error(
                "[LeadManager] Error updating lead %s: %s", lead_id, exc
            )

    def get_leads_without_email(
        self, vertical: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch leads that don't have an email yet."""
        if self.dry_run and not self.db:
            return []
        try:
            query = (
                self.db.table("growth_leads")
                .select("*")
                .is_("email", "null")
                .neq("status", "ignored")
            )
            if vertical:
                query = query.eq("vertical", vertical)

            result = query.order("created_at", desc=False).execute()
            return result.data or []
        except Exception as exc:
            logger.error("[LeadManager] Error fetching leads without email: %s", exc)
            return []

    def update_lead_email(self, lead_id: str, email: str) -> None:
        """Update a lead's email address."""
        if self.dry_run:
            logger.info(
                "[LeadManager][DRY-RUN] Would set email for %s → %s",
                lead_id, email,
            )
            return
        try:
            self.db.table("growth_leads").update(
                {"email": email, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", lead_id).execute()
            logger.info("[LeadManager] Email updated for lead %s: %s", lead_id, email)
        except Exception as exc:
            logger.error(
                "[LeadManager] Error updating email for %s: %s", lead_id, exc
            )

    def _lead_exists(self, linkedin_url: str) -> bool:
        """Check if a lead with this LinkedIn URL already exists."""
        if self.dry_run:
            return False
        try:
            result = (
                self.db.table("growth_leads")
                .select("id")
                .eq("linkedin_url", linkedin_url)
                .limit(1)
                .execute()
            )
            return bool(result.data)
        except Exception as exc:
            logger.error("[LeadManager] Dedup check error: %s", exc)
            return False

    def _contact_exists(self, full_name: str, email: Optional[str]) -> bool:
        """Check if a contact with this name or email already exists in the CRM."""
        if self.dry_run:
            return False
        try:
            # Check by email first (most reliable)
            if email:
                result = (
                    self.db.table("contacts")
                    .select("id")
                    .eq("email", email)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return True

            # Check by full name (first_name + last_name)
            if full_name:
                first_name, last_name = self._split_name(full_name)
                if first_name and last_name:
                    result = (
                        self.db.table("contacts")
                        .select("id")
                        .ilike("first_name", first_name)
                        .ilike("last_name", last_name)
                        .limit(1)
                        .execute()
                    )
                    if result.data:
                        return True

            return False
        except Exception as exc:
            logger.error("[LeadManager] CRM contacts dedup check error: %s", exc)
            return False

    @staticmethod
    def _is_valid_linkedin_url(url: str) -> bool:
        """Basic validation for LinkedIn profile URLs."""
        return bool(re.match(
            r"https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?",
            url,
        ))

    @staticmethod
    def _split_name(full_name: str) -> Tuple[Optional[str], Optional[str]]:
        """Split a full name into first and last name."""
        if not full_name:
            return None, None
        parts = full_name.strip().split(None, 1)
        first = parts[0] if len(parts) > 0 else None
        last = parts[1] if len(parts) > 1 else None
        return first, last

    def _log_stats(self) -> None:
        """Log processing statistics."""
        logger.info(
            "[LeadManager] Stats: %d processed, %d inserted, "
            "%d duplicates, %d errors",
            self.stats["processed"],
            self.stats["inserted"],
            self.stats["duplicates"],
            self.stats["errors"],
        )


# ============================================================================
# Agent 3: ContextualCopywriter
# ============================================================================
# GTM: Generates vertical-aware email drafts following the Bull's-eye
# framework messaging strategy. Each vertical has distinct tone,
# arguments, and anti-patterns.
#
# CRITICAL: This agent NEVER sends emails. All output is saved as
# drafts with status='draft_pending_review' for human review.

class ContextualCopywriter:
    """
    Generates personalized email drafts based on vertical strategy.

    Uses Claude AI (when ANTHROPIC_API_KEY is available) to generate
    truly unique emails per lead — adapting tone, arguments, and structure
    to each person's role, company, and vertical. Falls back to static
    templates when no API key is configured.

    Each draft respects:
    - The vertical's selling points and tone
    - The vertical's anti-patterns (what NOT to say)
    - Language detection based on lead geography
    - Visible placeholders for missing data

    Output: Drafts saved to growth_email_drafts with
    status='draft_pending_review'. NEVER sends emails.
    """

    ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
    ANTHROPIC_MODEL = "claude-sonnet-4-6"

    def __init__(self, supabase_client: Any, dry_run: bool = False):
        self.db = supabase_client
        self.dry_run = dry_run
        self.anthropic_key = (
            os.environ.get("ANTHROPIC_API_KEY")
            or os.environ.get("VITE_ANTHROPIC_API_KEY")
        )
        self.use_ai = bool(self.anthropic_key and httpx)
        if self.use_ai:
            logger.info("[Copywriter] AI mode enabled — emails will be generated with Claude")
        else:
            reason = "no httpx" if not httpx else "no ANTHROPIC_API_KEY"
            logger.info("[Copywriter] Template mode (%s) — using static templates", reason)
        self.stats = {
            "leads_processed": 0,
            "drafts_created": 0,
            "ai_generated": 0,
            "template_fallback": 0,
            "errors": 0,
        }

    def generate_drafts_for_vertical(
        self,
        leads: List[Dict[str, Any]],
        vertical: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate email drafts for a list of leads.

        Each lead must have: full_name, company, job_title, vertical, geo.
        Missing fields get visible placeholders: [NOMBRE], [EMPRESA], etc.
        """
        drafts_created = []

        for lead in leads:
            self.stats["leads_processed"] += 1
            v = vertical or lead.get("vertical", "DIRECT_B2B")

            if v not in VERTICAL_CONFIGS:
                logger.warning(
                    "[Copywriter] Unknown vertical '%s' for lead %s",
                    v, lead.get("linkedin_url"),
                )
                self.stats["errors"] += 1
                continue

            try:
                draft = self._generate_single_draft(lead, v)
                if draft:
                    drafts_created.append(draft)
                    self.stats["drafts_created"] += 1
            except Exception as exc:
                logger.error(
                    "[Copywriter] Error generating draft for %s: %s",
                    lead.get("linkedin_url"), exc,
                )
                self.stats["errors"] += 1

        self._log_stats()
        return drafts_created

    def _generate_single_draft(
        self, lead: Dict[str, Any], vertical: str
    ) -> Optional[Dict[str, Any]]:
        """Generate a single email draft for a lead (AI or template)."""
        config = VERTICAL_CONFIGS[vertical]
        lang = determine_language(lead.get("geo"))
        name = lead.get("full_name") or "[NOMBRE]"
        company = lead.get("company") or "[EMPRESA]"
        job_title = lead.get("job_title") or "[CARGO]"

        # Try AI generation first, fall back to templates
        if self.use_ai:
            ai_result = self._generate_with_ai(lead, vertical, config, lang)
            if ai_result:
                subject, body = ai_result
                self.stats["ai_generated"] += 1
                generation_method = "claude_ai"
            else:
                logger.warning(
                    "[Copywriter] AI generation failed for %s, falling back to template",
                    name,
                )
                subject, body = self._generate_from_template(lead, vertical, lang)
                self.stats["template_fallback"] += 1
                generation_method = "template_fallback"
        else:
            subject, body = self._generate_from_template(lead, vertical, lang)
            self.stats["template_fallback"] += 1
            generation_method = "template"

        if not subject or not body:
            return None

        draft_record = {
            "lead_id": lead.get("id"),
            "subject": subject,
            "body": body,
            "vertical": vertical,
            "language": lang,
            "status": "draft_pending_review",
            "generation_context": {
                "lead_name": lead.get("full_name"),
                "lead_company": lead.get("company"),
                "lead_job_title": lead.get("job_title"),
                "lead_email": lead.get("email"),
                "lead_linkedin": lead.get("linkedin_url"),
                "lead_geo": lead.get("geo"),
                "vertical_config": config["display_name"],
                "generation_method": generation_method,
                "ai_model": self.ANTHROPIC_MODEL if generation_method == "claude_ai" else None,
                "tone": config["email_tone"],
                "cta": config.get("email_cta", ""),
                "anti_patterns": config.get("anti_patterns", []),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

        if self.dry_run:
            logger.info(
                "[Copywriter][DRY-RUN] Would create draft (%s):\n"
                "  To: %s (%s)\n"
                "  Vertical: %s | Lang: %s\n"
                "  Subject: %s\n"
                "  Body preview: %.120s...",
                generation_method, name, company, vertical, lang,
                subject, body.replace("\n", " "),
            )
            return draft_record

        # Save to DB
        if not lead.get("id"):
            logger.warning(
                "[Copywriter] Lead has no ID, cannot save draft: %s",
                lead.get("linkedin_url"),
            )
            return draft_record

        try:
            result = (
                self.db.table("growth_email_drafts")
                .insert(draft_record)
                .execute()
            )
            if result.data:
                logger.info(
                    "[Copywriter] Draft created (%s) for %s (%s) — %s [%s]",
                    generation_method, name, company, vertical, lang,
                )
                return result.data[0]
            else:
                logger.error(
                    "[Copywriter] Insert returned no data for lead %s",
                    lead.get("id"),
                )
                self.stats["errors"] += 1
                return None
        except Exception as exc:
            logger.error(
                "[Copywriter] DB insert error for lead %s: %s",
                lead.get("id"), exc,
            )
            self.stats["errors"] += 1
            return None

    def _generate_from_template(
        self, lead: Dict[str, Any], vertical: str, lang: str
    ) -> Tuple[str, str]:
        """Generate email from static templates (original behavior)."""
        templates = EMAIL_TEMPLATES.get(vertical, {})
        lang_templates = templates.get(lang) or templates.get("en")
        if not lang_templates:
            logger.error(
                "[Copywriter] No templates for vertical=%s lang=%s",
                vertical, lang,
            )
            return "", ""

        template = random.choice(lang_templates)
        name = lead.get("full_name") or "[NOMBRE]"
        company = lead.get("company") or "[EMPRESA]"
        job_title = lead.get("job_title") or "[CARGO]"

        subject = template["subject"].format(
            name=name, company=company, job_title=job_title,
            event="[EVENT]",
        )
        body = template["body"].format(
            name=name, company=company, job_title=job_title,
            event="[EVENT]",
        )
        return subject, body

    def _generate_with_ai(
        self,
        lead: Dict[str, Any],
        vertical: str,
        config: Dict[str, Any],
        lang: str,
    ) -> Optional[Tuple[str, str]]:
        """
        Generate a personalized email using Claude AI.

        Builds a rich prompt with the lead's data and vertical strategy,
        producing a unique email adapted to the person's role, company,
        and context — similar to useEmailGeneration.js on the frontend.
        """
        name = lead.get("full_name") or "[NOMBRE]"
        company = lead.get("company") or "[EMPRESA]"
        job_title = lead.get("job_title") or "[CARGO]"
        geo = lead.get("geo") or "Unknown"

        lang_instructions = {
            "es": "Escribe SIEMPRE en ESPAÑOL (neutro/rioplatense según contexto).",
            "en": "Write ALWAYS in ENGLISH.",
            "pt": "Escreva SEMPRE em PORTUGUÊS.",
        }

        # Build selling points as text
        selling_points = config.get("selling_points", config.get("content_offers", []))
        selling_text = "\n".join(f"- {sp}" for sp in selling_points)

        anti_patterns = config.get("anti_patterns", [])
        anti_text = "\n".join(f"- {ap}" for ap in anti_patterns)

        scientific_ctx = ""
        if "scientific_context" in config:
            scientific_ctx = "\n".join(
                f"- {k}: {v}" for k, v in config["scientific_context"].items()
            )

        system_prompt = f"""Eres un asistente de comunicación comercial especializado para Digpatho IA, una startup argentina de biotecnología en patología digital.

## CONTEXTO DE LA EMPRESA
- Digpatho IA: Startup argentina especializada en análisis celular con IA para patología.
- Trayectoria en HER2, Ki67, RE, RP en cáncer de mama. Ahora expandiendo a Gleason/próstata.
- Diferenciadores: Tecnología validada en LATAM y África, modelo SaaS sin inversión en escáneres, funciona en cualquier dispositivo.

## VERTICAL ACTUAL: {config['display_name']}
Tono: {config['email_tone']}
CTA objetivo: {config.get('email_cta', 'reunión breve')}

## ARGUMENTOS CLAVE PARA ESTA VERTICAL
{selling_text}

{f'## CONTEXTO CIENTÍFICO{chr(10)}{scientific_ctx}' if scientific_ctx else ''}

## ANTI-PATRONES (lo que NUNCA debes mencionar en este vertical)
{anti_text}

## REGLAS CRUCIALES
1. Cada email debe ser ÚNICO — no repitas las mismas frases genéricas.
2. PERSONALIZA según el cargo, empresa y geografía del lead.
3. Si el lead tiene cargo conocido, adapta los argumentos a su función específica.
4. Mantén el email conciso: 4-6 párrafos máximo.
5. NO inventes datos, publicaciones o logros del lead.
6. Cierra con un CTA claro y específico.
7. {lang_instructions.get(lang, lang_instructions['en'])}

## FORMATO DE RESPUESTA
Responde EXACTAMENTE con este formato:

**Asunto:** [línea de asunto única y relevante para esta persona]

**Cuerpo:**
[contenido del email personalizado]"""

        user_prompt = f"""Genera un email de primer contacto para este lead:

**Nombre:** {name}
**Cargo:** {job_title}
**Empresa:** {company}
**Geografía:** {geo}
**Vertical:** {config['display_name']}

Recuerda:
- Adapta el tono y los argumentos a su cargo ({job_title}) y empresa ({company}).
- Haz que este email sea DIFERENTE de cualquier otro — no uses fórmulas genéricas.
- Si el cargo sugiere una función específica (director, investigador, BD, etc.), enfoca los argumentos a lo que le importa a esa persona.
- Si la empresa es conocida en el sector, menciónala de forma natural."""

        try:
            response = httpx.post(
                self.ANTHROPIC_API_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": self.ANTHROPIC_MODEL,
                    "max_tokens": 1500,
                    "temperature": 0.85,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                logger.error(
                    "[Copywriter] Claude API error %d: %s",
                    response.status_code, response.text[:200],
                )
                return None

            data = response.json()
            text = data["content"][0]["text"]
            return self._parse_ai_response(text)

        except Exception as exc:
            logger.error("[Copywriter] AI generation error: %s", exc)
            return None

    @staticmethod
    def _parse_ai_response(text: str) -> Optional[Tuple[str, str]]:
        """Parse Claude's response into (subject, body)."""
        subject_match = re.search(
            r"\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?\s*(.+?)(?=\n|$)", text, re.IGNORECASE
        )
        body_match = re.search(
            r"\*{0,2}\s*Cuerpo\s*:?\s*\*{0,2}\s*:?\s*([\s\S]*?)(?=\*{0,2}\s*Notas internas|$)",
            text, re.IGNORECASE,
        )

        subject = subject_match.group(1).strip() if subject_match else ""
        if body_match:
            body = body_match.group(1).strip()
        else:
            # Fallback: everything after subject
            body = re.sub(
                r"\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?.*\n?", "", text, flags=re.IGNORECASE
            ).strip()

        if not subject or not body:
            return None

        return subject, body

    def _log_stats(self) -> None:
        """Log generation statistics."""
        logger.info(
            "[Copywriter] Stats: %d leads processed, %d drafts created "
            "(%d AI-generated, %d template), %d errors",
            self.stats["leads_processed"],
            self.stats["drafts_created"],
            self.stats["ai_generated"],
            self.stats["template_fallback"],
            self.stats["errors"],
        )


# ============================================================================
# Pipeline Orchestrator
# ============================================================================

class GrowthPipeline:
    """
    Orchestrates the 3-agent pipeline:
        SafeSearcher → LeadManager → ContextualCopywriter

    Modes:
        search — Only search for leads (SafeSearcher + LeadManager)
        draft  — Only generate drafts for existing leads (ContextualCopywriter)
        full   — Complete pipeline: search + insert + draft
    """

    def __init__(
        self,
        vertical: str = "all",
        mode: str = "full",
        dry_run: bool = False,
        max_searches: int = 20,
    ):
        self.vertical = vertical
        self.mode = mode
        self.dry_run = dry_run
        self.max_searches = max_searches

        # Initialize Supabase client
        _load_env()
        if dry_run:
            logger.info("=== DRY RUN MODE — No database writes ===")
            self.db = self._get_db_client_or_none()
        else:
            self.db = _get_supabase_client()

        # Initialize agents
        self.searcher = SafeSearcher(max_searches=max_searches)
        self.lead_manager = LeadManager(self.db, dry_run=dry_run)
        self.copywriter = ContextualCopywriter(self.db, dry_run=dry_run)

    def run(self) -> Dict[str, Any]:
        """Execute the pipeline based on the configured mode."""
        logger.info(
            "=" * 60 + "\n"
            "  Digpatho AI Growth System\n"
            "  Vertical: %s | Mode: %s | Dry-run: %s\n"
            "  Max searches: %d\n" +
            "=" * 60,
            self.vertical, self.mode, self.dry_run, self.max_searches,
        )

        results = {
            "mode": self.mode,
            "vertical": self.vertical,
            "dry_run": self.dry_run,
            "leads_found": 0,
            "leads_inserted": 0,
            "leads_enriched": 0,
            "drafts_created": 0,
        }

        verticals = self._resolve_verticals()

        if self.mode in ("search", "full"):
            results.update(self._run_search_phase(verticals))

        if self.mode in ("enrich", "full"):
            results.update(self._run_enrich_phase(verticals))

        if self.mode in ("draft", "full"):
            results.update(self._run_draft_phase(verticals))

        self._print_summary(results)
        return results

    def _run_search_phase(
        self, verticals: List[str]
    ) -> Dict[str, int]:
        """Execute search + lead insertion."""
        logger.info("\n--- Phase 1: Search & Lead Insertion ---")
        total_found = 0
        total_inserted = 0

        for v in verticals:
            if self.searcher.searches_done >= self.max_searches:
                break
            logger.info("\n[Pipeline] Searching vertical: %s", v)
            raw_leads = self.searcher.search_vertical(v)
            total_found += len(raw_leads)

            inserted = self.lead_manager.process_leads(raw_leads)
            total_inserted += len(inserted)

        return {"leads_found": total_found, "leads_inserted": total_inserted}

    def _run_enrich_phase(
        self, verticals: List[str]
    ) -> Dict[str, int]:
        """Find emails for existing leads that don't have one."""
        logger.info("\n--- Phase: Email Enrichment ---")
        total_enriched = 0

        for v in verticals:
            if self.searcher.searches_done >= self.max_searches:
                break

            leads = self.lead_manager.get_leads_without_email(vertical=v)
            if not leads:
                logger.info("[Pipeline] No leads without email in %s", v)
                continue

            logger.info(
                "[Pipeline] Enriching %d leads in %s",
                len(leads), v,
            )

            for lead in leads:
                if self.searcher.searches_done >= self.max_searches:
                    logger.warning(
                        "[Pipeline] Max searches reached during enrichment"
                    )
                    break

                name = lead.get("full_name")
                company = lead.get("company")
                if not name:
                    continue

                email = self.searcher.search_email_for_lead(name, company)
                if email:
                    self.lead_manager.update_lead_email(lead["id"], email)
                    total_enriched += 1
                    logger.info(
                        "[Pipeline] Enriched: %s → %s", name, email,
                    )

        return {"leads_enriched": total_enriched}

    def _run_draft_phase(
        self, verticals: List[str]
    ) -> Dict[str, int]:
        """Generate email drafts for leads without drafts."""
        logger.info("\n--- Phase 2: Email Draft Generation ---")
        total_drafts = 0

        for v in verticals:
            logger.info("\n[Pipeline] Generating drafts for vertical: %s", v)

            if self.dry_run and self.mode == "full":
                # In full+dry_run, use the leads we just "found"
                leads = [
                    r for r in self.searcher.results
                    if r.get("vertical") == v
                ]
            else:
                leads = self.lead_manager.get_leads_without_drafts(
                    vertical=v
                )

            if not leads:
                logger.info(
                    "[Pipeline] No new leads for %s — skipping draft generation",
                    v,
                )
                continue

            logger.info(
                "[Pipeline] Found %d leads needing drafts in %s",
                len(leads), v,
            )
            drafts = self.copywriter.generate_drafts_for_vertical(leads, v)
            total_drafts += len(drafts)

            # Update lead status to 'draft_generated'
            for lead in leads:
                lead_id = lead.get("id")
                if lead_id:
                    self.lead_manager.update_lead_status(
                        lead_id, "draft_generated"
                    )

        return {"drafts_created": total_drafts}

    def _resolve_verticals(self) -> List[str]:
        """Resolve the vertical argument to a list of vertical names."""
        if self.vertical == "all":
            return list(VERTICAL_CONFIGS.keys())
        if self.vertical in VERTICAL_CONFIGS:
            return [self.vertical]
        logger.error("Unknown vertical: %s", self.vertical)
        sys.exit(1)

    def _get_db_client_or_none(self) -> Any:
        """Try to create a Supabase client; return None if not possible."""
        try:
            return _get_supabase_client()
        except SystemExit:
            logger.warning(
                "No Supabase credentials found. Dry-run will proceed "
                "without database access."
            )
            return None

    @staticmethod
    def _print_summary(results: Dict[str, Any]) -> None:
        """Print a final summary of the pipeline run."""
        logger.info(
            "\n" + "=" * 60 + "\n"
            "  PIPELINE SUMMARY\n"
            "  Mode: %s | Vertical: %s | Dry-run: %s\n"
            "  Leads found:    %d\n"
            "  Leads inserted: %d\n"
            "  Leads enriched (email): %d\n"
            "  Drafts created: %d\n"
            "  \n"
            "  All drafts saved with status='draft_pending_review'.\n"
            "  Review in Supabase dashboard before sending.\n" +
            "=" * 60,
            results["mode"],
            results["vertical"],
            results["dry_run"],
            results["leads_found"],
            results["leads_inserted"],
            results.get("leads_enriched", 0),
            results["drafts_created"],
        )


# ============================================================================
# CLI
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        description=(
            "Digpatho AI Growth System — Intelligent B2B Prospecting.\n"
            "Generates email DRAFTS for human review. Never sends automatically."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s --vertical PHARMA --mode search\n"
            "  %(prog)s --vertical DIRECT_B2B --mode draft\n"
            "  %(prog)s --vertical all --mode enrich\n"
            "  %(prog)s --vertical all --mode full\n"
            "  %(prog)s --vertical all --mode full --dry-run\n"
            "\n"
            "Verticals: DIRECT_B2B, PHARMA, INFLUENCER, EVENTS, all\n"
            "Modes:     search (find leads), enrich (find emails for existing leads),\n"
            "           draft (generate emails), full (search + enrich + draft)\n"
        ),
    )
    parser.add_argument(
        "--vertical",
        choices=["DIRECT_B2B", "PHARMA", "INFLUENCER", "EVENTS", "all"],
        default="all",
        help="Target vertical (default: all)",
    )
    parser.add_argument(
        "--mode",
        choices=["search", "enrich", "draft", "full"],
        default="full",
        help="Execution mode: search, enrich (find emails), draft, full (default: full)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Log actions without writing to the database",
    )
    parser.add_argument(
        "--max-searches",
        type=int,
        default=20,
        help="Maximum number of Google searches per run (default: 20)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Enable debug-level logging",
    )
    return parser


def main() -> None:
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger("digpatho.growth").setLevel(logging.DEBUG)

    pipeline = GrowthPipeline(
        vertical=args.vertical,
        mode=args.mode,
        dry_run=args.dry_run,
        max_searches=args.max_searches,
    )
    pipeline.run()


if __name__ == "__main__":
    main()
