"use client";

import { useState } from "react";
import { EmailSignIn } from "./EmailSignIn";
import { PhoneSignIn } from "./PhoneSignIn";

type Method = "email" | "phone";

const LABELS: Readonly<Record<Method, string>> = { email: "Email", phone: "Mobile OTP" };

export function SignInTabs() {
  const [method, setMethod] = useState<Method>("email");
  return (
    <div>
      <div role="tablist" aria-label="Sign-in method" className="tabs">
        {(Object.keys(LABELS) as Method[]).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={method === key}
            className={method === key ? "tab tab-active" : "tab"}
            onClick={() => setMethod(key)}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <div role="tabpanel">{method === "email" ? <EmailSignIn /> : <PhoneSignIn />}</div>
    </div>
  );
}
