"use client";

import { useState } from "react";
import { addPhoto, deletePhoto } from "@/app/actions/gallery";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2, Share2, Expand } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  caption: string;
  uploadedBy: { name: string | null };
  createdAt: Date;
}

interface PhotoGalleryProps {
  photos: Photo[];
  userId: string;
}

export function PhotoGallery({ photos, userId }: PhotoGalleryProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !caption) return;
    setIsLoading(true);
    try {
      const result = await addPhoto(url, caption, userId);
      if (result?.success) {
        toast.success("Photo added successfully");
        setUrl("");
        setCaption("");
        router.refresh();
      } else {
        toast.error(result?.error || "Failed to add photo");
      }
    } catch (error) {
      toast.error("Failed to add photo. Please logout and login again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      await deletePhoto(id);
      toast.success("Photo deleted");
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete photo");
    }
  };

  const handleShare = (photo: Photo) => {
    const text = `Check out this photo: ${photo.caption} - ${photo.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Add New Photo</CardTitle>
          <CardDescription className="text-zinc-400">Share moments with your academy.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Image URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <Button type="submit" disabled={isLoading || !url || !caption} className="w-full">
              {isLoading ? "Adding..." : "Add Photo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="bg-zinc-950 border-zinc-800 text-zinc-100 overflow-hidden">
            <div className="relative aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption} className="object-cover w-full h-full" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-900" onClick={() => { setSelectedPhoto(photo); setIsDialogOpen(true); }}>
                  <Expand className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <p className="font-medium truncate">{photo.caption}</p>
              <p className="text-xs text-zinc-400 mt-1">By {photo.uploadedBy.name || "Unknown"}</p>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between">
              <Button variant="outline" size="sm" onClick={() => handleShare(photo)} className="border-zinc-800 text-zinc-100 hover:bg-zinc-900">
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeletePhoto(photo.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-4xl w-full p-1 overflow-hidden">
          {selectedPhoto && (
            <div className="flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPhoto.url} alt={selectedPhoto.caption} className="w-full max-h-[80vh] object-contain bg-black" />
              <div className="p-4 bg-zinc-950">
                <p className="font-semibold">{selectedPhoto.caption}</p>
                <p className="text-sm text-zinc-400">Uploaded by {selectedPhoto.uploadedBy.name || "Unknown"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
