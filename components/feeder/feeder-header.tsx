"use client";

import Link from "next/link";
import { ArrowLeft, Check, Trash2, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Feeder, formatDate } from "./types";

interface FeederHeaderProps {
  feeder: Feeder;
  copiedItem: "uuid" | "command" | "share" | null;
  isEditOpen: boolean;
  isDeleteOpen: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  editName: string;
  editLat: string;
  editLng: string;
  onShare: () => void;
  onOpenEdit: () => void;
  onEditOpenChange: (open: boolean) => void;
  onDeleteOpenChange: (open: boolean) => void;
  onEditNameChange: (value: string) => void;
  onEditLatChange: (value: string) => void;
  onEditLngChange: (value: string) => void;
  onUpdateFeeder: (e: React.FormEvent) => void;
  onDeleteFeeder: () => void;
}

export function FeederHeader({
  feeder,
  copiedItem,
  isEditOpen,
  isDeleteOpen,
  isUpdating,
  isDeleting,
  editName,
  editLat,
  editLng,
  onShare,
  onOpenEdit,
  onEditOpenChange,
  onDeleteOpenChange,
  onEditNameChange,
  onEditLatChange,
  onEditLngChange,
  onUpdateFeeder,
  onDeleteFeeder,
}: FeederHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          href="/feeders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Feeders
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onShare}>
            {copiedItem === "share" ? (
              <Check className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {copiedItem === "share" ? "Copied!" : "Share"}
          </Button>
          <Dialog open={isEditOpen} onOpenChange={onEditOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={onOpenEdit}>
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Feeder</DialogTitle>
                <DialogDescription>
                  Update your feeder&apos;s name and location.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onUpdateFeeder}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Feeder Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => onEditNameChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-lat">Latitude</Label>
                      <Input
                        id="edit-lat"
                        type="number"
                        step="any"
                        value={editLat}
                        onChange={(e) => onEditLatChange(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-lng">Longitude</Label>
                      <Input
                        id="edit-lng"
                        type="number"
                        step="any"
                        value={editLng}
                        onChange={(e) => onEditLngChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating || !editName}>
                    {isUpdating ? "Saving\u2026" : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Feeder</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{feeder.name}&quot;? This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onDeleteOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteFeeder}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting\u2026" : "Delete Feeder"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{feeder.name}</h1>
            <Badge variant={feeder.isOnline ? "success" : "secondary"}>
              {feeder.isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Registered {formatDate(feeder.createdAt)}
          </p>
        </div>
      </div>
    </>
  );
}
