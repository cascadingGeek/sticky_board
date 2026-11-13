/** Which sites Sticky Board may run on, read from what Chrome has granted. */

/** The access pattern for one site: one exact host (no port), http and https. */
export const siteOrigin = (hostname: string) => `*://${hostname}/*`;

/** The host part used in access patterns (match patterns can't hold a port). */
export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const WEB_ORIGIN = /^(\*|https?):\/\//;

/** Origins Sticky Board may run on, from what Chrome says is granted. */
export const grantedWebOrigins = async (): Promise<string[]> => {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter(o => WEB_ORIGIN.test(o));
};

export interface SiteAccess {
  hosts: string[]; // sites allowed one at a time
  allSites: string[]; // broad grants made in Chrome (shown as "All sites")
}

/** Splits granted origins into single sites and broad grants. */
export const splitOrigins = (origins: string[]): SiteAccess => {
  const hosts: string[] = [];
  const allSites: string[] = [];
  for (const o of origins) {
    const m = o.match(/^\*:\/\/([^/*]+)\/\*$/);
    if (m?.[1]) hosts.push(m[1]);
    else if (WEB_ORIGIN.test(o)) allSites.push(o);
  }
  return { hosts: [...new Set(hosts)].sort(), allSites };
};
