import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBatchProcess } from "@/hooks/use-episodes";
import { useToast } from "@/hooks/use-toast";
import type { ExtractionMethod } from "@/types";

interface BatchProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractionMethod: ExtractionMethod;
}

export default function BatchProcessDialog({
  open,
  onOpenChange,
  extractionMethod
}: BatchProcessDialogProps) {
  const [urlsInput, setUrlsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const batchProcessMutation = useBatchProcess();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Process URLs: split by newline, filter empty lines, and trim whitespace
    const urls = urlsInput
      .split("\n")
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      setError("Please enter at least one URL");
      return;
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => !url.includes("youtube.com/") && !url.includes("youtu.be/"));
    if (invalidUrls.length > 0) {
      setError(`Found ${invalidUrls.length} invalid YouTube URLs. Please check your input.`);
      return;
    }
    
    try {
      setIsSubmitting(true);
      const result = await batchProcessMutation.mutateAsync({ 
        urls, 
        extractionMethod 
      });
      
      // Count successful and failed processes
      const successful = result.results.filter((r: any) => r.success).length;
      const failed = result.results.filter((r: any) => !r.success).length;
      
      toast({
        title: "Batch Process Started",
        description: `Successfully queued ${successful} episodes${failed > 0 ? `, ${failed} failed` : ''}.`,
        variant: successful > 0 ? "default" : "destructive",
      });
      
      // Reset form and close dialog if at least one was successful
      if (successful > 0) {
        setUrlsInput("");
        onOpenChange(false);
      }
    } catch (error: any) {
      setError(error.message || "An error occurred while processing your request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Batch Process Episodes</DialogTitle>
          <DialogDescription>
            Enter one YouTube URL per line to process multiple episodes using web scraping.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="urls">YouTube URLs (one per line)</Label>
            <Textarea
              id="urls"
              placeholder="https://www.youtube.com/watch?v=..."
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              rows={8}
              className="font-mono text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start Batch Processing"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 