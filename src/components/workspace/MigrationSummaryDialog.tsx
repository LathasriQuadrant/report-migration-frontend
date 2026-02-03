import { ArrowRight, FolderOpen, FileBarChart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TreeNode } from '@/types/migration';
import { SelectedPowerBIWorkspace } from '@/components/workspace/DestinationWorkspaceSelection';

interface MigrationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceNode: TreeNode | undefined;
  sourceName: string;
  destinationWorkspace: SelectedPowerBIWorkspace | null;
  onConfirm: () => void;
}

const MigrationSummaryDialog = ({
  open,
  onOpenChange,
  sourceNode,
  sourceName,
  destinationWorkspace,
  onConfirm,
}: MigrationSummaryDialogProps) => {
  if (!sourceNode || !destinationWorkspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Migration Summary</DialogTitle>
          <DialogDescription>
            Review the migration details before proceeding
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Source & Destination Visual */}
          <div className="flex items-center justify-center gap-4">
            {/* Source */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-2">
                <FileBarChart className="w-7 h-7 text-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-sm font-medium max-w-[120px] truncate">{sourceNode.name}</p>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-6 h-6 text-muted-foreground shrink-0" />

            {/* Destination */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <FolderOpen className="w-7 h-7 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="text-sm font-medium max-w-[120px] truncate">{destinationWorkspace.name}</p>
            </div>
          </div>

          {/* Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Source Platform</span>
              <span className="font-medium">{sourceName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Item Type</span>
              <span className="font-medium capitalize">{sourceNode.type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-medium">Power BI</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This will migrate your {sourceNode.type} to the selected Power BI workspace. 
            The process may take a few minutes depending on the size.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="powerbi" onClick={onConfirm}>
            Start Migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MigrationSummaryDialog;