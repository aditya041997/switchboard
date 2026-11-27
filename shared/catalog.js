// Well-known interview problems grouped by pattern. Titles match LeetCode so each can be linked.
// E, M and H are the difficulty.
const PATTERNS = {
  'Arrays & hashing':
    'E:Two Sum|E:Contains Duplicate|E:Valid Anagram|M:Group Anagrams|M:Top K Frequent Elements|M:Product of Array Except Self|M:Longest Consecutive Sequence|M:Subarray Sum Equals K|E:Majority Element|M:Next Permutation|M:Set Matrix Zeroes|M:Rotate Image|M:Spiral Matrix|H:First Missing Positive',
  'Two pointers':
    'E:Valid Palindrome|E:Move Zeroes|E:Merge Sorted Array|M:Two Sum II - Input Array Is Sorted|M:3Sum|M:Container With Most Water|M:Sort Colors|M:4Sum|H:Trapping Rain Water',
  'Sliding window':
    'E:Best Time to Buy and Sell Stock|M:Longest Substring Without Repeating Characters|M:Longest Repeating Character Replacement|M:Permutation in String|M:Max Consecutive Ones III|M:Fruit Into Baskets|H:Minimum Window Substring|H:Sliding Window Maximum',
  'Binary search':
    'E:Binary Search|M:Search a 2D Matrix|M:Find First and Last Position of Element in Sorted Array|M:Search in Rotated Sorted Array|M:Find Minimum in Rotated Sorted Array|M:Find Peak Element|M:Koko Eating Bananas|M:Capacity To Ship Packages Within D Days|H:Split Array Largest Sum|H:Median of Two Sorted Arrays',
  'Linked list':
    'E:Reverse Linked List|E:Merge Two Sorted Lists|E:Linked List Cycle|E:Middle of the Linked List|M:Linked List Cycle II|M:Remove Nth Node From End of List|M:Reorder List|M:Add Two Numbers|M:Copy List with Random Pointer|H:Reverse Nodes in k-Group',
  'Stack & monotonic stack':
    'E:Valid Parentheses|M:Min Stack|M:Evaluate Reverse Polish Notation|M:Daily Temperatures|M:Next Greater Element II|M:Asteroid Collision|M:Decode String|H:Largest Rectangle in Histogram',
  Trees:
    'E:Maximum Depth of Binary Tree|E:Invert Binary Tree|E:Same Tree|E:Diameter of Binary Tree|E:Balanced Binary Tree|M:Binary Tree Level Order Traversal|M:Binary Tree Right Side View|M:Lowest Common Ancestor of a Binary Tree|M:Construct Binary Tree from Preorder and Inorder Traversal|H:Binary Tree Maximum Path Sum|H:Serialize and Deserialize Binary Tree',
  'Binary search tree':
    'M:Validate Binary Search Tree|M:Kth Smallest Element in a BST|M:Lowest Common Ancestor of a Binary Search Tree|M:Delete Node in a BST|M:Binary Search Tree Iterator',
  'Heap & priority queue':
    'E:Last Stone Weight|M:Kth Largest Element in an Array|M:K Closest Points to Origin|M:Task Scheduler|M:Reorganize String|H:Merge k Sorted Lists|H:Find Median from Data Stream',
  'Intervals & greedy':
    'M:Merge Intervals|M:Insert Interval|M:Non-overlapping Intervals|M:Maximum Subarray|M:Jump Game|M:Jump Game II|M:Gas Station|M:Partition Labels|H:Candy',
  Backtracking:
    'M:Subsets|M:Subsets II|M:Permutations|M:Combination Sum|M:Combination Sum II|M:Generate Parentheses|M:Letter Combinations of a Phone Number|M:Palindrome Partitioning|M:Word Search|H:N-Queens|H:Sudoku Solver',
  Graphs:
    'M:Number of Islands|M:Max Area of Island|M:Clone Graph|M:Rotting Oranges|M:Pacific Atlantic Water Flow|M:Surrounded Regions|M:Number of Provinces|M:Is Graph Bipartite?|H:Word Ladder',
  'Topological sort & union find':
    'M:Course Schedule|M:Course Schedule II|M:Find Eventual Safe States|M:Redundant Connection|M:Accounts Merge|M:Number of Operations to Make Network Connected',
  'Shortest path & spanning tree':
    'M:Network Delay Time|M:Path With Minimum Effort|M:Cheapest Flights Within K Stops|M:Min Cost to Connect All Points|H:Swim in Rising Water',
  Trie: 'M:Implement Trie (Prefix Tree)|M:Design Add and Search Words Data Structure|M:Maximum XOR of Two Numbers in an Array|H:Word Search II',
  'Dynamic programming 1D':
    'E:Climbing Stairs|E:Min Cost Climbing Stairs|M:House Robber|M:House Robber II|M:Coin Change|M:Longest Increasing Subsequence|M:Word Break|M:Decode Ways|M:Maximum Product Subarray|M:Partition Equal Subset Sum',
  'Dynamic programming 2D':
    'M:Unique Paths|M:Minimum Path Sum|M:Longest Common Subsequence|M:Longest Palindromic Substring|M:Coin Change II|M:Target Sum|M:Edit Distance|H:Distinct Subsequences|H:Burst Balloons',
  'Bit manipulation':
    'E:Single Number|E:Number of 1 Bits|E:Counting Bits|E:Missing Number|M:Sum of Two Integers',
  Design:
    'M:LRU Cache|M:Insert Delete GetRandom O(1)|M:Design Twitter|M:Time Based Key-Value Store|H:LFU Cache',
};

const LEVEL = { E: 'Easy', M: 'Medium', H: 'Hard' };
export const CATALOG_VERSION = 1;
export const slug = (title) =>
  title
    .toLowerCase()
    .replace(/\(x,? ?n?\)/g, (m) => (m.includes('n') ? 'x-n' : 'x'))
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/[ -]+/g, '-');

export const CATALOG = Object.entries(PATTERNS).flatMap(([pattern, list]) =>
  list.split('|').map((entry) => {
    const problem = entry.slice(2);
    return { id: `lc-${slug(problem)}`, pattern, problem, difficulty: LEVEL[entry[0]] };
  }),
);
const BY_TITLE = new Map(CATALOG.map((p) => [p.problem.toLowerCase(), p]));

export const problemUrl = (title) =>
  BY_TITLE.has(title.toLowerCase())
    ? `https://leetcode.com/problems/${slug(title)}/`
    : `https://leetcode.com/problemset/?search=${encodeURIComponent(title)}`;

/** Adds catalog problems that are missing, keeping the user's progress on existing ones. */
export function mergeCatalog(problems) {
  const have = new Set(problems.map((p) => String(p.problem).toLowerCase()));
  const kept = problems.map((p) => {
    const match = BY_TITLE.get(String(p.problem).toLowerCase());
    return match ? { ...p, pattern: match.pattern } : p;
  });
  const added = CATALOG.filter((p) => !have.has(p.problem.toLowerCase())).map((p) => ({
    ...p,
    status: 'To practise',
    lastPractised: '',
  }));
  return [...kept, ...added];
}

/** Reads lines of "pattern | problem | difficulty", skipping duplicates. */
export function parseImport(textValue, existing, makeId) {
  const seen = new Set(existing.map((p) => p.problem.toLowerCase()));
  const out = [];
  for (const line of textValue.split('\n')) {
    const [pattern, problem, level = ''] = line.split('|').map((x) => x.trim());
    if (!pattern || !problem || seen.has(problem.toLowerCase())) continue;
    seen.add(problem.toLowerCase());
    const difficulty = Object.values(LEVEL).find((x) => x.toLowerCase() === level.toLowerCase());
    out.push({
      id: makeId(),
      pattern,
      problem,
      difficulty: difficulty || 'Medium',
      status: 'To practise',
      lastPractised: '',
    });
  }
  return out;
}
