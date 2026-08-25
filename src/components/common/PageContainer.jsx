// src/components/common/PageContainer.jsx
//
// Contenedor raíz de las páginas. Antes cada una traía el suyo y no coincidían:
// unas con `p-6 max-w-7xl mx-auto`, otras con `space-y-6 animate-fade-in`,
// otras con `max-w-5xl`, algunas sin padding y algunas sin animación. El
// resultado era que el ancho y el margen superior cambiaban al navegar.
//
// El ancho SÍ varía a propósito según el tipo de página, así que se expone
// como prop en vez de forzar uno solo:
//   - wide   (default) listados y tableros: aprovechan el ancho
//   - medium fichas de detalle: texto largo, más cómodo angosto
//   - narrow formularios de configuración
//
// OJO: acá NO va padding. MainLayout ya envuelve el <Outlet> en
// `p-6 lg:p-8`, así que las páginas que además traían su propio `p-6`
// (BulkEmail, GrowthSystem) venían con el margen duplicado.
//
// Uso:  <PageContainer>...</PageContainer>
//       <PageContainer width="narrow" gap="lg">...</PageContainer>

const WIDTHS = {
  wide: 'max-w-7xl',
  medium: 'max-w-5xl',
  narrow: 'max-w-3xl',
  full: '',
};

const GAPS = {
  none: '',
  md: 'space-y-6',
  lg: 'space-y-8',
};

export const PageContainer = ({
  children,
  width = 'wide',
  gap = 'md',
  className = '',
}) => {
  const widthClass = WIDTHS[width] ?? WIDTHS.wide;
  const gapClass = GAPS[gap] ?? GAPS.md;

  return (
    <div className={`mx-auto animate-fade-in ${widthClass} ${gapClass} ${className}`.trim()}>
      {children}
    </div>
  );
};

export default PageContainer;
