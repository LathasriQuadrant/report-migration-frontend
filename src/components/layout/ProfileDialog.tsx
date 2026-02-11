import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, User } from 'lucide-react';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileDialog = ({ open, onOpenChange }: ProfileDialogProps) => {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const profileFields = [
    { label: 'Name', value: user?.name, icon: User },
    { label: 'Email', value: user?.email, icon: Mail },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Details</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          <Avatar className="w-20 h-20 mb-4">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
              {user ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold">{user?.name}</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="space-y-3 border-t pt-4">
          {profileFields.map((field) => (
            <div key={field.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <field.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="text-sm font-medium truncate" title={field.value || ''}>
                  {field.value || 'Not available'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
