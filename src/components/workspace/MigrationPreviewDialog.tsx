 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { BookOpen, LayoutDashboard, FileText, Loader2 } from "lucide-react";
 
 interface MigrationPreviewDialogProps {
   isOpen: boolean;
   onConfirm: () => void;
   onCancel: () => void;
   isLoading?: boolean;
   workbookName: string;
   projectName?: string;
   viewCount: number;
 }
 
 const MigrationPreviewDialog = ({
   isOpen,
   onConfirm,
   onCancel,
   isLoading = false,
   workbookName,
   projectName,
   viewCount,
 }: MigrationPreviewDialogProps) => {
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Migration Summary</DialogTitle>
           <DialogDescription>
             Review the content that will be migrated to Power BI
           </DialogDescription>
         </DialogHeader>
 
         <div className="py-4 space-y-4">
           {/* Workbook Info */}
           <div className="p-4 rounded-lg bg-muted/50 border border-border">
             <div className="flex items-start gap-3">
               <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                 <BookOpen className="w-5 h-5 text-primary" />
               </div>
               <div>
                 <p className="font-medium text-foreground">{workbookName}</p>
                 {projectName && (
                   <p className="text-sm text-muted-foreground">{projectName}</p>
                 )}
               </div>
             </div>
           </div>
 
           {/* Migration Counts */}
           <div className="grid grid-cols-3 gap-3">
             <div className="p-3 rounded-lg border border-border text-center">
               <BookOpen className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
               <p className="text-xl font-semibold text-foreground">1</p>
               <p className="text-xs text-muted-foreground">Workbook</p>
             </div>
             <div className="p-3 rounded-lg border border-border text-center">
               <LayoutDashboard className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
               <p className="text-xl font-semibold text-foreground">{viewCount}</p>
               <p className="text-xs text-muted-foreground">Sheets/Views</p>
             </div>
             <div className="p-3 rounded-lg border border-border text-center">
               <FileText className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
               <p className="text-xl font-semibold text-foreground">{viewCount > 0 ? Math.ceil(viewCount / 2) : 0}</p>
               <p className="text-xs text-muted-foreground">Dashboards</p>
             </div>
           </div>
 
           <p className="text-sm text-muted-foreground text-center">
             This migration will create corresponding Power BI reports for all selected content.
           </p>
         </div>
 
         <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="outline" onClick={onCancel} disabled={isLoading}>
             Cancel
           </Button>
           <Button variant="powerbi" onClick={onConfirm} disabled={isLoading}>
             {isLoading ? (
               <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Preparing...
               </>
             ) : (
               "Start Migration"
             )}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default MigrationPreviewDialog;