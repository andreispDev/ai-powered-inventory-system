"use client";

import { useId } from "react";

const FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

/** Shows the viewer's own time zone. The inline script corrects server-rendered text before paint. */
export function LocalTime({ date }: { date: Date | string }) {
  const id = useId();
  const iso = new Date(date).toISOString();
  return (
    <>
      <time id={id} dateTime={iso} suppressHydrationWarning>
        {new Date(iso).toLocaleString(undefined, FORMAT)}
      </time>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=new Date(${JSON.stringify(iso)}).toLocaleString(undefined,${JSON.stringify(FORMAT)})}`,
        }}
      />
    </>
  );
}
