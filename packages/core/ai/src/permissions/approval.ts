export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ContentType = 'schema' | 'collection' | 'workflow' | 'page';

export interface ApprovalRequest {
  id: string;
  contentType: ContentType;
  generatedBy: string; // AI Employee/Agent ID
  triggeredBy: string; // User ID
  status: ApprovalStatus;
  content: any; // The generated content
  diff?: any; // Change comparison
  approvers: string[]; // Who can approve
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  comment?: string;
}

let nextId = 1;

function generateId(): string {
  return `apr_${String(nextId++).padStart(8, '0')}`;
}

export class ApprovalManager {
  private requests: Map<string, ApprovalRequest> = new Map(); // In production, persist to DB

  // Create a new approval request
  async createRequest(
    options: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>,
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: generateId(),
      status: 'pending',
      createdAt: new Date(),
      ...options,
    };
    this.requests.set(request.id, request);
    return request;
  }

  // Approve a request
  async approve(
    requestId: string,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalRequest> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }
    if (!request.approvers.includes(approverId)) {
      throw new Error(`User ${approverId} is not an authorized approver for this request`);
    }

    request.status = 'approved';
    request.resolvedAt = new Date();
    request.resolvedBy = approverId;
    request.comment = comment;
    return request;
  }

  // Reject a request
  async reject(
    requestId: string,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalRequest> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }
    if (!request.approvers.includes(approverId)) {
      throw new Error(`User ${approverId} is not an authorized approver for this request`);
    }

    request.status = 'rejected';
    request.resolvedAt = new Date();
    request.resolvedBy = approverId;
    request.comment = comment;
    return request;
  }

  // Get pending requests for a user (as approver)
  getPendingForApprover(approverId: string): ApprovalRequest[] {
    const results: ApprovalRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.status === 'pending' && request.approvers.includes(approverId)) {
        results.push(request);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Get requests by triggering user
  getByUser(userId: string): ApprovalRequest[] {
    const results: ApprovalRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.triggeredBy === userId) {
        results.push(request);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Get a specific request
  getRequest(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  // Check if a user can approve (must be in approvers list)
  canApprove(requestId: string, userId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) return false;
    return request.status === 'pending' && request.approvers.includes(userId);
  }

  // Reset state (for testing)
  reset(): void {
    this.requests.clear();
    nextId = 1;
  }
}
