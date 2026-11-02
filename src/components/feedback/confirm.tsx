"use client";

import { CircleHelp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ConfirmProps = {
  title: string;
  description: string;
  confirmLabel: string;
  /** Red styling, for actions that remove access or data */
  destructive?: boolean;
  onConfirm: () => void;
  /** Leave out when opening it from code, such as from a menu item */
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Every one-click change goes through this, so nothing happens by accident. */
export function Confirm({ title, description, confirmLabel, destructive, onConfirm, children, open, onOpenChange }: ConfirmProps) {
  const Icon = destructive ? TriangleAlert : CircleHelp;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <span
            className={cn(
              "mb-1 flex size-9 items-center justify-center rounded-full",
              destructive ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
