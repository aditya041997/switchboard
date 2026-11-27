// Links into the codestorywithMIK YouTube channel. They search the channel, so they keep
// working when videos are added or playlists are reorganised.
const CHANNEL = 'https://www.youtube.com/@codestorywithMIK';
export const PLAYLISTS_URL = `${CHANNEL}/playlists`;
const search = (query) => `${CHANNEL}/search?query=${encodeURIComponent(query)}`;

const TOPICS = {
  'Arrays & hashing': 'array',
  'Two pointers': 'two pointer',
  'Sliding window': 'sliding window',
  'Binary search': 'binary search',
  'Linked list': 'linked list',
  'Stack & monotonic stack': 'monotonic stack',
  Trees: 'binary tree',
  'Binary search tree': 'binary search tree',
  'Heap & priority queue': 'heap',
  'Intervals & greedy': 'greedy',
  Backtracking: 'backtracking',
  Graphs: 'graph',
  'Topological sort & union find': 'topological sort',
  'Shortest path & spanning tree': 'dijkstra',
  Trie: 'trie',
  'Dynamic programming 1D': 'dynamic programming',
  'Dynamic programming 2D': 'dynamic programming',
  'Bit manipulation': 'bit manipulation',
  Design: 'design data structure',
};

export const patternVideosUrl = (pattern) => search(TOPICS[pattern] || pattern);
export const problemVideoUrl = (title) => search(title);

/** Accepts only https YouTube links, so a saved link can never run script. */
export function youtubeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const ok = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(
      url.hostname,
    );
    return url.protocol === 'https:' && ok ? url.href : '';
  } catch {
    return '';
  }
}
