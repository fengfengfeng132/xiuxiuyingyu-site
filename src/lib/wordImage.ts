const WIKI_API = 'https://en.wikipedia.org/w/api.php';

interface WikiPage {
  thumbnail?: {
    source?: string;
  };
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiPage>;
    search?: Array<{ title: string }>;
  };
}

const imageCache = new Map<string, string | null>();

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

async function fetchJson(params: Record<string, string>): Promise<WikiQueryResponse | null> {
  try {
    const url = new URL(WIKI_API);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = (await response.json()) as WikiQueryResponse;
    return data;
  } catch {
    return null;
  }
}

function extractThumbnail(data: WikiQueryResponse | null): string | null {
  if (!data?.query?.pages) return null;
  const pages = Object.values(data.query.pages);
  const source = pages.find((page) => page.thumbnail?.source)?.thumbnail?.source;
  return source ?? null;
}

async function fetchByTitle(title: string): Promise<string | null> {
  const data = await fetchJson({
    action: 'query',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '640',
    redirects: '1',
    titles: title,
  });
  return extractThumbnail(data);
}

async function searchTitle(word: string): Promise<string | null> {
  const data = await fetchJson({
    action: 'query',
    list: 'search',
    srsearch: word,
    srlimit: '1',
    srprop: '',
  });

  return data?.query?.search?.[0]?.title ?? null;
}

export async function fetchWordImage(word: string): Promise<string | null> {
  const key = normalizeWord(word);
  if (!key) return null;

  if (imageCache.has(key)) {
    return imageCache.get(key) ?? null;
  }

  let image = await fetchByTitle(key);
  if (!image) {
    const searchedTitle = await searchTitle(key);
    if (searchedTitle) {
      image = await fetchByTitle(searchedTitle);
    }
  }

  imageCache.set(key, image ?? null);
  return image ?? null;
}
