import { getApiStatus, type ApiStatus } from "@/lib/api-status";
import { LAUNCH_STREAMS } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Readonly<Record<ApiStatus, string>> = {
  online: "API online",
  degraded: "API degraded",
  offline: "API offline",
};

const ROLES = [
  { title: "Students", text: "Learn, practise and revise with an AI tutor that cites the course." },
  { title: "Tutors", text: "Build courses with an AI copilot and earn from every enrolment." },
  {
    title: "Institutes",
    text: "Nodal officers onboard batches, allocate seats and track progress.",
  },
] as const;

export default async function HomePage() {
  const status = await getApiStatus(process.env.NEXT_PUBLIC_API_URL);

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Pragya · प्रज्ञा</p>
        <h1>AI-powered learning, starting with Pathology.</h1>
        <p className="lede">
          Courses for MBBS, healthcare and beyond, with an AI tutor, exam-grade practice and
          leaderboards.
        </p>
        <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      <section aria-labelledby="streams-heading">
        <h2 id="streams-heading">Streams</h2>
        <ul className="cards">
          {LAUNCH_STREAMS.map((stream) => (
            <li key={stream.slug} className="card">
              <h3>{stream.name}</h3>
              <p>{stream.courses.join(", ")}</p>
              <span className="tag">
                {stream.status === "launching" ? "Launching first" : "Planned"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading">Built for</h2>
        <ul className="cards">
          {ROLES.map((role) => (
            <li key={role.title} className="card">
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
