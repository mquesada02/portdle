// The attribute that the app sets on <html> once it has hydrated the page (or
// rendered it, on a page with no prerendered markup). Until then a prerendered
// button is on screen but has no handler, so a click on it is lost. The browser
// specs (gate/, e2e/) wait for this attribute before they click.
export const HYDRATED_ATTRIBUTE = "data-hydrated";
