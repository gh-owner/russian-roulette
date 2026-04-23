import process from "node:process";

type Post = { publicId: string; createdAt: string; username: string };
type Feed = { posts: Post[] };
type User = { username: string };

const NOW = Date.now();
const DISCUIT_MOD_USERNAME = "ILostTheGame";
const DISCUIT_MOD_PASSWORD = process.env.DISCUIT_MOD_PASSWORD;
const TIMER = 5 * 60 * 1000;
const BAN_DURATION = 24 * 60 * 60 * 1000;
const COMMUNITY_ID = "18a86774eed778f377e8eb05"; // RussianRoulette community id

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

// get posts from last $TIMER ms
const feed = await fetch(
  `https://discuit.org/api/posts?limit=50&communityId=${COMMUNITY_ID}`,
).then(async (r) => {
  const feed: Feed = await r.json();
  if (!feed.posts) {
    console.log("No posts in feed.");
    process.exit();
  }
  return feed;
});
const posts = feed.posts.filter(
  (post) => new Date(post.createdAt) > new Date(NOW - TIMER),
);

let somethingHappened = false;
for (const post of posts) {
  const random = Math.floor(Math.random() * 6);
  console.log(`Rolled a ${random}`);
  let message = "";

  if (random === 2) {
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
    message = `${post.username} has been banned for ${BAN_DURATION / 60 / 60 / 1000} hours`;
  } else {
    message = `${post.username} is safe today`;
  }

  console.log(message);
  await fetch(`https://discuit.org/api/posts/${post.publicId}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parentCommentId: null,
      body: `[BOT] ${message}`,
    }),
  });
  somethingHappened = true;
}

// unban everyone banned more than $BAN_DURATION ago
const bannedUsers: User[] = await fetch(
  `https://discuit.org/api/communities/${COMMUNITY_ID}/banned`,
  {
    headers,
  },
).then((r) => r.json());
for (const user of bannedUsers) {
  const post = feed.posts.find((post) => post.username === user.username);
  if (!post) continue;

  const createdAt = new Date(post.createdAt);
  const bannedAgo = new Date(NOW - BAN_DURATION);
  if (createdAt > bannedAgo) continue;

  await fetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      username: user.username,
    }),
  }).then(async (r) => {
    if (!r.ok) {
      const error = await r.json();
      console.error(`Failed to unban ${user.username}: ${error.message}`);
      process.exit(1);
    }
  });
  console.log(`Unbanned ${user.username}`);
  somethingHappened = true;
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

if (somethingHappened) {
  process.exit(2);
}
