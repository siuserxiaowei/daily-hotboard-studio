export const PLATFORM_GROUPS = [
  {
    id: "ai-source",
    label: "AI 专门源",
    platforms: [
      "hf-daily-papers",
      "arxiv-ai",
      "hf-models",
      "hf-datasets",
      "hf-spaces",
      "github-ai",
      "hn-ai",
      "openai-news",
      "deepmind-news",
      "hf-blog"
    ]
  },
  {
    id: "research",
    label: "研究论文",
    platforms: ["hf-daily-papers", "arxiv-ai"]
  },
  {
    id: "open-source",
    label: "开源生态",
    platforms: ["hf-models", "hf-datasets", "hf-spaces", "github-ai", "hellogithub"]
  },
  {
    id: "official",
    label: "官方发布",
    platforms: ["openai-news", "deepmind-news", "hf-blog"]
  },
  {
    id: "social",
    label: "社交舆论",
    platforms: ["weibo", "zhihu", "douyin", "kuaishou", "tieba", "hupu", "douban-group"]
  },
  {
    id: "video",
    label: "视频社区",
    platforms: ["bilibili", "acfun"]
  },
  {
    id: "news",
    label: "新闻资讯",
    platforms: ["baidu", "toutiao", "thepaper", "qq-news", "sina-news", "netease-news"]
  },
  {
    id: "tech",
    label: "科技产品",
    platforms: ["ithome", "36kr", "huxiu", "ifanr", "sspai", "juejin", "csdn", "v2ex", "hellogithub"]
  },
  {
    id: "culture",
    label: "内容文化",
    platforms: ["weread", "zhihu-daily", "douban-movie", "netease-music", "qq-music"]
  },
  {
    id: "games",
    label: "游戏娱乐",
    platforms: ["lol", "genshin", "honkai", "starrail"]
  }
];

export const PLATFORM_META = {
  bilibili: { label: "哔哩哔哩", accent: "#00a1d6" },
  acfun: { label: "A站", accent: "#fd4c5d" },
  weibo: { label: "微博热搜", accent: "#e6162d" },
  zhihu: { label: "知乎热榜", accent: "#1772f6" },
  "zhihu-daily": { label: "知乎日报", accent: "#2f80ed" },
  douyin: { label: "抖音", accent: "#111111" },
  kuaishou: { label: "快手", accent: "#ff6600" },
  "douban-movie": { label: "豆瓣电影", accent: "#238a3b" },
  "douban-group": { label: "豆瓣小组", accent: "#3ba55d" },
  tieba: { label: "百度贴吧", accent: "#3385ff" },
  hupu: { label: "虎扑", accent: "#c00000" },
  ngabbs: { label: "NGA论坛", accent: "#8f6724" },
  v2ex: { label: "V2EX", accent: "#4b5563" },
  "52pojie": { label: "吾爱破解", accent: "#4677b8" },
  hostloc: { label: "全球主机交流", accent: "#64748b" },
  coolapk: { label: "酷安", accent: "#13c45d" },
  baidu: { label: "百度热搜", accent: "#2932e1" },
  thepaper: { label: "澎湃新闻", accent: "#2563eb" },
  toutiao: { label: "今日头条", accent: "#d71920" },
  "qq-news": { label: "腾讯新闻", accent: "#1479ff" },
  sina: { label: "新浪热搜", accent: "#e90e24" },
  "sina-news": { label: "新浪新闻", accent: "#e90e24" },
  "netease-news": { label: "网易新闻", accent: "#d81e06" },
  huxiu: { label: "虎嗅", accent: "#f2b705" },
  ifanr: { label: "爱范儿", accent: "#111827" },
  sspai: { label: "少数派", accent: "#d71920" },
  ithome: { label: "IT之家", accent: "#cc0000" },
  "ithome-xijiayi": { label: "IT之家喜加一", accent: "#f97316" },
  juejin: { label: "掘金", accent: "#1e80ff" },
  jianshu: { label: "简书", accent: "#ea6f5a" },
  guokr: { label: "果壳", accent: "#50b347" },
  "36kr": { label: "36氪", accent: "#0f172a" },
  "51cto": { label: "51CTO", accent: "#2563eb" },
  csdn: { label: "CSDN", accent: "#c92027" },
  nodeseek: { label: "NodeSeek", accent: "#2563eb" },
  hellogithub: { label: "HelloGitHub", accent: "#111827" },
  lol: { label: "英雄联盟", accent: "#c89b3c" },
  genshin: { label: "原神", accent: "#6d8fb3" },
  honkai: { label: "崩坏3", accent: "#2b77d9" },
  starrail: { label: "星穹铁道", accent: "#a855f7" },
  "netease-music": { label: "网易云音乐", accent: "#d33a31" },
  "qq-music": { label: "QQ音乐", accent: "#31c27c" },
  weread: { label: "微信读书", accent: "#22c55e" },
  weatheralarm: { label: "天气预警", accent: "#f97316" },
  earthquake: { label: "地震速报", accent: "#ef4444" },
  history: { label: "历史上的今天", accent: "#7c3aed" },
  "hf-daily-papers": { label: "HF 每日论文", accent: "#f59e0b" },
  "arxiv-ai": { label: "arXiv AI", accent: "#b31b1b" },
  "hf-models": { label: "HF 模型", accent: "#ffcc4d" },
  "hf-datasets": { label: "HF 数据集", accent: "#f97316" },
  "hf-spaces": { label: "HF Spaces", accent: "#16a34a" },
  "github-ai": { label: "GitHub AI", accent: "#24292f" },
  "hn-ai": { label: "HN AI", accent: "#ff6600" },
  "openai-news": { label: "OpenAI 官方", accent: "#10a37f" },
  "deepmind-news": { label: "DeepMind 官方", accent: "#4285f4" },
  "hf-blog": { label: "HF Blog", accent: "#ffcc4d" }
};

export const DEFAULT_PLATFORMS = [
  "weibo",
  "zhihu",
  "bilibili",
  "douyin",
  "baidu",
  "toutiao",
  "thepaper",
  "ithome",
  "36kr",
  "huxiu",
  "sspai",
  "v2ex",
  "weread",
  "hellogithub"
];
