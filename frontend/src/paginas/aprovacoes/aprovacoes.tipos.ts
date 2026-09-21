import type {
  ApprovalConfig,
  ApprovalWorkflow,
  IARecord,
  StatusAuditoria,
  UserProfile,
} from "@/tipos";

export interface ApprovalPageProps {
  records: IARecord[];
  profiles: UserProfile[];
  workflows: ApprovalWorkflow[];
  approvalConfig: ApprovalConfig;
  currentUserId?: string;
  onUpdateStatus: (
    recordId: string,
    status: StatusAuditoria,
    comment?: string,
    extraFields?: unknown,
  ) => void | Promise<void>;
  onSaveApprovalConfig: (config: ApprovalConfig) => void | Promise<void>;
  onViewRecord: (record: IARecord) => void;
  isAdmin: boolean;
}
