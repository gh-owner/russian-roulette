import process from "node:process";

type Post = { createdAt: string; username: string };
type Feed = { posts: Post[] };

const NOW = Date.now();
const DISCUIT_MOD_USERNAME = "ILostTheGame";
const DISCUIT_MOD_PASSWORD = process.env.DISCUIT_MOD_PASSWORD;
const TIMER = 5 * 60 * 1000;
const BAN_DURATION = 24 * 60 * 60 * 1000;
const COMMUNITY_ID = "18a86774eed778f377e8eb05"; // RussianRoulette community id
const POST_ID = process.argv[2];

// get csrf and sid
const headers: Record<string, string> = await fetch(
  "https://discuit.org/api/_initial",
).then(({ headers }) => ({
  Cookie:
    headers
      .getSetCookie()
      .find((c) => c.includes("SID="))
      ?.split(";")
      .find((c) => c.includes("SID=")) ?? "",
  "X-Csrf-Token": headers.get("csrf-token") || "",
}));

// log in to discuit
if (!DISCUIT_MOD_PASSWORD) {
  console.error("Discuit moderator password not set");
  process.exit(1);
}
await fetch("https://discuit.org/api/_login", {
  method: "POST",
  headers,
  body: JSON.stringify({
    username: DISCUIT_MOD_USERNAME,
    password: DISCUIT_MOD_PASSWORD,
  }),
}).then(async (res) => {
  if (!res.ok) {
    const error = await res.json();
    console.error(`Failed to log in: ${error.message}`);
    process.exit(1);
  }
});

// get post from id
const post = await fetch(
  `https://discuit.org/api/posts/${POST_ID}`
).then((r) => r.json());
const random = Math.floor(Math.random() * 6);
console.log(`Rolled a ${random}`);
if (random == 1) {
  await fetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: post.username,
    }),
  }).then(async (r) => {
    if (!r.ok) {
      const error = await r.json();
      console.error(`Failed to ban ${post.username}: ${error.message}`);
      process.exit(1);
    }
  });
  console.log(`${post.username} has been banned for ${BAN_DURATION}ms`);
} else {
  console.log(`${post.username} is safe today`);
}

// log out of discuit
await fetch("https://discuit.org/api/_login?action=logout", {
  method: "POST",
  headers,
}).then(async (r) => {
  if (!r.ok) {
    const error = await r.json();
    console.error(`Failed to log out: ${error.message}`);
    process.exit(1);
  }
});
