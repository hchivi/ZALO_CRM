import { useRouter as nativeRouter, useRoute as nativeRoute } from 'vue-router';
export function useRoute(){const route=nativeRoute();return new Proxy(route,{get(target,key){if(key==='path'){for(const [source,destination] of Object.entries(paths))if(target.path===destination || target.path.startsWith(destination+'/'))return source+target.path.slice(destination.length);}return (target as any)[key];}});}
const paths: Record<string,string> = {"/chat": "/cskh/chat", "/contacts": "/cskh/contacts", "/appointments": "/cskh/appointments", "/handovers": "/cskh/handovers", "/warehouse": "/cskh/warehouse", "/media": "/cskh/warehouse?tab=media", "/orders": "/cskh/orders", "/catalog": "/cskh/warehouse?tab=catalog", "/reports": "/cskh/reports", "/dashboard": "/cskh/dashboard", "/attendance": "/cskh/attendance", "/needs": "/cskh/needs", "/accounting/needs": "/cskh/needs", "/zalo-accounts": "/cskh/zalo-accounts", "/api-settings": "/cskh/api-settings", "/settings": "/cskh/settings", "/ai": "/cskh/ai", "/login": "/login", "/setup": "/system/settings"};
const names: Record<string,string> = { Chat:'ZaloMessages', Contacts:'ZaloLeads', ContactDetail:'ZaloContactDetail', Appointments:'Appointments', Handovers:'ShiftHandovers', Warehouse:'Warehouse', Media:'Warehouse', Orders:'ZaloOrders', Catalog:'Warehouse', Reports:'CskhReport', Dashboard:'ZaloOverview', Attendance:'Attendance', ZaloAccounts:'ZaloAccounts', ApiSettings:'ApiWebhook', Settings:'ZaloSettings' };
export function mapLocation(location: any): any {
  if (typeof location === 'string') {
    for (const [source,target] of Object.entries(paths)) if (location === source || location.startsWith(source+'/') || location.startsWith(source+'?')) return target+location.slice(source.length);
    return location;
  }
  if (location?.name && names[location.name]) return {...location,name:names[location.name]};
  if (location?.path) return {...location,path:mapLocation(location.path)};
  return location;
}
export function useRouter() { const router=nativeRouter(); return new Proxy(router,{ get(target,key) { if (['push','replace','resolve'].includes(String(key))) return (location:any) => (target as any)[key](mapLocation(location)); return (target as any)[key]; } }); }
