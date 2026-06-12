export interface AuditEntry{
    action:string;
    targetModel:string;
    targetId:string;
    meta:object;
    performedAt:Date;
    details:string;
    ipAddress:string;
}