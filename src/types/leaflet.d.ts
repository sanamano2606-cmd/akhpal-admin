// Ambient declaration for Leaflet.
//
// The map is imported dynamically at runtime and only ever used through a
// small, well-understood slice of its API, so the full @types/leaflet package
// is not pulled in. Declaring the module here keeps `tsc` happy without adding
// a second dependency that has to be kept in version step with leaflet itself.
declare module "leaflet";
declare module "leaflet/dist/leaflet.css";
