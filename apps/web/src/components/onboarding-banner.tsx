"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading } from "./card";

export function OnboardingBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => {
        const goals = d.goals ?? [];
        setShow(goals.length === 0);
      });
  }, []);

  if (!show) return null;

  return (
    <Card className="border-brand-cyan/30 bg-brand-cyan/5">
      <CardHeading>Welcome to motivelife.ai</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Start with one goal. motivelife.ai will help you break it into actions, suggest what to do
        next, and track your progress over time.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/dashboard#life-gps">
          <Button size="sm">Create your first goal</Button>
        </Link>
        <Button size="sm" variant="ghost" onClick={() => setShow(false)}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
