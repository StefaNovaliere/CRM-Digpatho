/**
 * Institution entity - pure domain model.
 */
export class Institution {
  constructor({
    id = null,
    name = '',
    type = '',
    country = 'Argentina',
    city = '',
    address = '',
    website = '',
    notes = '',
    created_at = null,
    updated_at = null
  } = {}) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.country = country;
    this.city = city;
    this.address = address;
    this.website = website;
    this.notes = notes;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  get location() {
    return [this.city, this.country].filter(Boolean).join(', ');
  }
}
