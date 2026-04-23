import {
  BAN_DURATION,
  COMMUNITY_ID,
  DISCUIT_MOD_PASSWORD,
  DISCUIT_MOD_USERNAME,
  MAGIC_NUMBER,
} from "./constants";
import { LeaderboardRow, Post } from "./types";

export async function mfetch(input: string, init?: RequestInit) {
  return await fetch(input, init).then(async (r) => {
    if (!r.ok) {
      const error = await r.json();
      console.error(
        `Request failed
${init?.method ?? "GET"} ${input}
Body: ${init?.body}
Error: ${error}
`,
      );
      process.exit(1);
    }
    return r;
  });
}

export async function getHeaders(): Promise<Record<string, string>> {
  return await mfetch("https://discuit.org/api/_initial").then(
    ({ headers }) => ({
      Cookie:
        headers
          .getSetCookie()
          .find((c) => c.includes("SID="))
          ?.split(";")
          .find((c) => c.includes("SID=")) ?? "",
      "X-Csrf-Token": headers.get("csrf-token") || "",
    }),
  );
}

export async function login(headers: Record<string, string>) {
  if (!DISCUIT_MOD_PASSWORD) {
    console.error("Discuit moderator password not set");
    process.exit(1);
  }
  await mfetch("https://discuit.org/api/_login", {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: DISCUIT_MOD_USERNAME,
      password: DISCUIT_MOD_PASSWORD,
    }),
  });
}

export async function logout(headers: Record<string, string>) {
  await mfetch("https://discuit.org/api/_login?action=logout", {
    method: "POST",
    headers,
  });
}

export async function getLeaderboard(
  headers: Record<string, string>,
): Promise<LeaderboardRow[]> {
  const leaderboardPost: Post = await mfetch(
    `https://discuit.org/api/posts/fGdYBOUJ`,
    {
      headers,
    },
  ).then((r) => r.json());

  return leaderboardPost.body
    .split("\n")
    .slice(2)
    .map((row) => {
      const captures = row.match(/\| (\d+) \| \[(\w+)\]\(\/@\w+\) \| (\d+) \|/);
      if (!captures) {
        console.error("Row did not match expected format");
        process.exit(1);
      }
      const [rank, name, banCount] = captures!.slice(1, 4);
      return {
        rank: Number.parseInt(rank),
        name,
        banCount: Number.parseInt(banCount),
      };
    });
}

export async function rollBan(
  headers: Record<string, string>,
  post: Post,
  rows: LeaderboardRow[],
) {
  const random = Math.floor(Math.random() * 6);
  console.log(`Rolled a ${random}`);
  let message = "";

  if (random === MAGIC_NUMBER) {
    await mfetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        username: post.username,
      }),
    });
    message = `${post.username} has been banned for ${BAN_DURATION / 60 / 60 / 1000} hours`;
    const existingRow = rows.findIndex((row) => row.name == post.username);
    if (existingRow == -1) {
      rows.push({ rank: rows.length, name: post.username, banCount: 1 });
    } else {
      rows[existingRow].banCount++;
    }
  } else {
    message = `${post.username} is safe today`;
  }

  console.log(message);
  await mfetch(`https://discuit.org/api/posts/${post.publicId}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parentCommentId: null,
      body: `[BOT] ${message}`,
    }),
  });
}

export async function updateLeaderboard(
  headers: Record<string, string>,
  rows: LeaderboardRow[],
) {
  rows.sort((a, b) => {
    if (a.banCount == b.banCount) {
      return a.rank - b.rank;
    }
    return b.banCount - a.banCount;
  });
  const rendered =
    `| Rank | Name | Bans |
  | --- | --- | --- |
  ` +
    rows
      .map(
        (row, index) =>
          `| ${index + 1} | [${row.name}](/@${row.name}) | ${row.banCount} |`,
      )
      .join("\n");
  await mfetch(`https://discuit.org/api/posts/fGdYBOUJ`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      body: rendered,
    }),
  });
}
