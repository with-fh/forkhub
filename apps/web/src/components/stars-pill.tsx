import { FORKHUB_REPO_API_ID, FORKHUB_REPO_URL } from "@/lib/site";

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;
}

async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${FORKHUB_REPO_API_ID}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

// Live GitHub star counter for the nav pill. Degrades to a plain
// "Star on GitHub" link when the API is unreachable or rate-limited.
export default async function StarsPill() {
  const stars = await getStars();
  return (
    <a
      className="fh-nav-stars"
      href={FORKHUB_REPO_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={
        stars === null ? "Star ForkHub on GitHub" : `Star ForkHub on GitHub — ${stars} stars`
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.3l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.12l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.3z" />
      </svg>
      {stars === null ? (
        <span>
          <strong>ForkHub</strong> on GitHub
        </span>
      ) : (
        <span>
          <strong>{formatStars(stars)}</strong> GitHub stars
        </span>
      )}
    </a>
  );
}
