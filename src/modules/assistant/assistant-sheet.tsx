"use client";

import { Maximize2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AssistantChat } from "./assistant-chat";

/** Opens the assistant over any page. */
export function AssistantSheet() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open assistant" title="Assistant">
          <Sparkles aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            Assistant
            <Button variant="ghost" size="icon-xs" asChild>
              <Link href="/assistant" aria-label="Open full page with history" title="Open full page with history" onClick={() => setOpen(false)}>
                <Maximize2 aria-hidden />
              </Link>
            </Button>
          </SheetTitle>
          <SheetDescription className="sr-only">Ask questions about your inventory.</SheetDescription>
        </SheetHeader>
        <AssistantChat />
      </SheetContent>
    </Sheet>
  );
}
