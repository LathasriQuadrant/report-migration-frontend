import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/layout/AppLayout';
import { MigrationRecord } from '@/types/migration';

const sampleHistory: MigrationRecord[] = [
  {
    id: 'mig-1',
    sourceSystem: 'tableau',
    sourcePath: 'Sales & Marketing / Q4 2024 Analytics / Sales Overview',
    reportName: 'Regional Performance',
    status: 'completed',
    startedAt: new Date('2024-12-15T14:30:00'),
    completedAt: new Date('2024-12-15T14:35:00'),
    powerBILink: '/report/mig-1',
  },
  {
    id: 'mig-2',
    sourceSystem: 'microstrategy',
    sourcePath: 'Enterprise Reports / Financial',
    reportName: 'Financial KPIs Dashboard',
    status: 'completed',
    startedAt: new Date('2024-12-15T10:15:00'),
    completedAt: new Date('2024-12-15T10:22:00'),
    powerBILink: '/report/mig-2',
  },
  {
    id: 'mig-3',
    sourceSystem: 'sapbo',
    sourcePath: 'CRM Analytics / Customer Insights',
    reportName: 'Customer 360 View',
    status: 'running',
    startedAt: new Date('2024-12-15T15:00:00'),
  },
  {
    id: 'mig-4',
    sourceSystem: 'tableau',
    sourcePath: 'Operations / Supply Chain',
    reportName: 'Inventory Management',
    status: 'completed',
    startedAt: new Date('2024-12-14T09:00:00'),
    completedAt: new Date('2024-12-14T09:08:00'),
    powerBILink: '/report/mig-4',
  },
  {
    id: 'mig-5',
    sourceSystem: 'cognos',
    sourcePath: 'HR Analytics / Workforce',
    reportName: 'Employee Dashboard',
    status: 'failed',
    startedAt: new Date('2024-12-13T16:45:00'),
    completedAt: new Date('2024-12-13T16:48:00'),
  },
  {
    id: 'mig-6',
    sourceSystem: 'tableau',
    sourcePath: 'Marketing / Campaign Analytics',
    reportName: 'Campaign Performance',
    status: 'completed',
    startedAt: new Date('2024-12-13T11:20:00'),
    completedAt: new Date('2024-12-13T11:26:00'),
    powerBILink: '/report/mig-6',
  },
];

const sourceLabels: Record<string, string> = {
  tableau: 'Tableau',
  microstrategy: 'MicroStrategy',
  sapbo: 'SAP BO',
  cognos: 'Cognos',
};

const History = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const filteredHistory = sampleHistory.filter((item) => {
    const matchesSearch = item.reportName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourcePath.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !filterStatus || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <button
            onClick={() => navigate('/')}
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Migration History</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Migration History</h1>
              <p className="text-sm text-muted-foreground">
                View and manage all your report migrations
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by report name or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* History table */}
        <div className="bg-card rounded-xl border border-border enterprise-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Report
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Source
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Started
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Duration
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistory.map((item) => {
                  const duration = item.completedAt
                    ? Math.round((item.completedAt.getTime() - item.startedAt.getTime()) / 60000)
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{item.reportName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {item.sourcePath}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-muted-foreground">
                          {sourceLabels[item.sourceSystem]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                            ${item.status === 'completed' ? 'status-completed' : ''}
                            ${item.status === 'running' ? 'status-running pulse-running' : ''}
                            ${item.status === 'failed' ? 'status-failed' : ''}
                          `}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'completed'
                                ? 'bg-success'
                                : item.status === 'running'
                                ? 'bg-info'
                                : 'bg-destructive'
                            }`}
                          />
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {formatDate(item.startedAt)}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {duration !== null ? `${duration} min` : '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {item.status === 'completed' && item.powerBILink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(item.powerBILink!)}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                        {item.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No migrations found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default History;
