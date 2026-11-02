export type Job = {
  id: string;
  source: string; // shown on every card for attribution
  title: string;
  company: string;
  url: string; // always the original listing on the source site
  location: string;
  type: string;
  tags: string[];
  text: string; // title + tags + plain-text description, used for matching
};

export type JobsResult = { jobs: Job[]; loaded: string[]; failed: string[] };

type Adapter = { name: string; site: string; fetch: () => Promise<Job[]> };

const stripHtml = (html: string) =>
  new DOMParser().parseFromString(html ?? "", "text/html").body.textContent ?? "";

const build = (j: Omit<Job, "text"> & { description: string }): Job => {
  const { description, ...rest } = j;
  return { ...rest, text: `${j.title} ${j.tags.join(" ")} ${stripHtml(description)}` };
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ---- Adapters: each one maps a source's response into the shared Job type ----

const remotive: Adapter = {
  name: "Remotive",
  site: "https://remotive.com",
  fetch: async () => {
    const data = await getJson("https://remotive.com/api/remote-jobs?category=software-dev&limit=100");
    return data.jobs.map((j: any) =>
      build({
        id: `remotive:${j.id}`, source: "Remotive", title: j.title, company: j.company_name,
        url: j.url, location: j.candidate_required_location || "Anywhere",
        type: (j.job_type || "").replace("_", " "), tags: j.tags ?? [], description: j.description,
      })
    );
  },
};

const arbeitnow: Adapter = {
  name: "Arbeitnow",
  site: "https://www.arbeitnow.com",
  fetch: async () => {
    const data = await getJson("https://www.arbeitnow.com/api/job-board-api");
    return data.data
      .filter((j: any) => j.remote) // keep remote roles only
      .map((j: any) =>
        build({
          id: `arbeitnow:${j.slug}`, source: "Arbeitnow", title: j.title, company: j.company_name,
          url: j.url, location: j.location || "Remote", type: (j.job_types ?? []).join(", "),
          tags: j.tags ?? [], description: j.description,
        })
      );
  },
};

const remoteOk: Adapter = {
  name: "Remote OK",
  site: "https://remoteok.com",
  fetch: async () => {
    const data = await getJson("https://remoteok.com/api");
    return data
      .filter((j: any) => j.id && j.position) // first array item is a legal notice
      .map((j: any) =>
        build({
          id: `remoteok:${j.id}`, source: "Remote OK", title: j.position, company: j.company,
          url: j.url, location: j.location || "Anywhere", type: "",
          tags: j.tags ?? [], description: j.description,
        })
      );
  },
};

export const ADAPTERS: Adapter[] = [remotive, arbeitnow, remoteOk];

// ---- Caching: sources ask for few requests, so reuse results for an hour ----

const TTL_MS = 60 * 60 * 1000;

async function withCache(a: Adapter): Promise<Job[]> {
  const key = `resumematch:${a.name}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { at, jobs } = JSON.parse(raw);
      if (Date.now() - at < TTL_MS) return jobs as Job[];
    }
  } catch { /* storage unavailable: go to network */ }

  const jobs = await a.fetch();
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), jobs }));
  } catch { /* quota or blocked: ignore */ }
  return jobs;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function fetchJobs(): Promise<JobsResult> {
  // allSettled: one failing source must not break the others
  const results = await Promise.allSettled(ADAPTERS.map(withCache));
  const loaded: string[] = [];
  const failed: string[] = [];
  const seen = new Set<string>();
  const jobs: Job[] = [];

  results.forEach((r, i) => {
    const name = ADAPTERS[i].name;
    if (r.status === "rejected") return void failed.push(name);
    loaded.push(name);
    for (const job of r.value) {
      const key = `${norm(job.title)}|${norm(job.company)}`; // drop cross-board duplicates
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }
  });

  return { jobs, loaded, failed };
}
