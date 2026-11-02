import { useMemo, useState } from "react";
import { ADAPTERS, fetchJobs, type Job } from "./jobs";
import { extractSkills, matchJob } from "./match";

type Status = "idle" | "loading" | "ready" | "error";

// Loaded on demand so the heavy PDF library is not in the first bundle.
const loadParser = () => import("./parse");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-300";

function Chip({ children, on }: { children: React.ReactNode; on: boolean }) {
  return (
    <li
      className={
        "rounded-full px-2.5 py-0.5 text-sm " +
        (on
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")
      }
    >
      {children}
    </li>
  );
}

export default function App() {
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("loading");
    setError("");
    try {
      const { readResume } = await loadParser();
      const text = await readResume(file);
      const found = extractSkills(text);
      if (found.size === 0) throw new Error("No known skills found in this resume.");
      setSkills(found);
      const result = await fetchJobs();
      if (result.jobs.length === 0) throw new Error("No job sources responded. Try again in a few minutes.");
      setJobs(result.jobs);
      setLoaded(result.loaded);
      setFailed(result.failed);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const ranked = useMemo(
    () =>
      jobs
        .map((job) => ({ job, match: matchJob(skills, job.text) }))
        .filter(({ match }) => match.score !== null)
        .sort((a, b) => b.match.score! - a.match.score!),
    [jobs, skills]
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">ResumeMatch</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Upload your resume and see which remote software jobs fit your skills. Your file is read in your browser and
            never uploaded.
          </p>
        </header>

        <label
          className={`my-5 block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white p-7 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-600 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:outline-teal-300`}
        >
          <span>{status === "loading" ? "Reading resume…" : "Choose a PDF or DOCX resume"}</span>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={onFile}
            disabled={status === "loading"}
            className="mx-auto mt-2.5 block max-w-full"
          />
        </label>

        <div aria-live="polite">
          {status === "error" && (
            <p role="alert" className="font-semibold text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {status === "ready" && (
          <>
            <section aria-labelledby="skills-h">
              <h2 id="skills-h" className="mb-2.5 mt-7 text-lg font-semibold">
                Skills found ({skills.size})
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {[...skills].sort().map((s) => (
                  <Chip key={s} on>
                    {s}
                  </Chip>
                ))}
              </ul>
            </section>

            <section aria-labelledby="jobs-h">
              <h2 id="jobs-h" className="mb-2.5 mt-7 text-lg font-semibold">
                Matching jobs ({ranked.length})
              </h2>

              {failed.length > 0 && (
                <p role="status" className="mb-3 rounded-md bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700">
                  Could not load: {failed.join(", ")}. Showing jobs from {loaded.join(", ")}.
                </p>
              )}

              {ranked.length === 0 && <p>No jobs with recognisable skills were found. Try again later.</p>}

              <ul className="grid gap-2.5">
                {ranked.map(({ job, match }) => (
                  <li
                    key={job.id}
                    className="flex gap-3.5 rounded-lg border border-slate-300 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div
                      aria-label={`${match.score}% match`}
                      className="grid size-14 flex-none place-items-center rounded-full border-[3px] border-emerald-700 font-bold text-emerald-700 dark:border-emerald-300 dark:text-emerald-300"
                    >
                      {match.score}%
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`text-teal-700 underline dark:text-teal-300 ${focusRing}`}
                        >
                          {job.title}
                        </a>
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        {job.company} · {job.location}
                        {job.type && ` · ${job.type}`} ·{" "}
                        <span className="rounded border border-slate-300 px-2 py-px text-xs text-teal-700 dark:border-slate-600 dark:text-teal-300">
                          {job.source}
                        </span>
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {match.matched.map((s) => (
                          <Chip key={s} on>
                            {s}
                          </Chip>
                        ))}
                        {match.missing.map((s) => (
                          <Chip key={s} on={false}>
                            {s}
                          </Chip>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <footer className="mt-10 text-sm text-slate-600 dark:text-slate-400">
          Jobs from{" "}
          {ADAPTERS.map((a, i) => (
            <span key={a.name}>
              {i > 0 && ", "}
              <a
                href={a.site}
                target="_blank"
                rel="noreferrer"
                className={`text-teal-700 underline dark:text-teal-300 ${focusRing}`}
              >
                {a.name}
              </a>
            </span>
          ))}
          . Each job links back to its original listing. Matching is keyword-based, so treat scores as a guide.
        </footer>
      </main>
    </div>
  );
}
