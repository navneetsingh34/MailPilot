const PREVIEW_LENGTH = 140;

/** Plain-text version of an email body, for list previews and the search index. */
export const htmlToPreview = (html: string, maxLength = PREVIEW_LENGTH) =>
  html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
