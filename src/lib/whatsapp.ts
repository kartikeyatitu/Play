// WhatsApp Business API configuration
export const WHATSAPP_CONFIG = {
  apiUrl: process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  isConfigured: !!process.env.WHATSAPP_ACCESS_TOKEN,
};

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "fee_reminder" | "attendance_alert" | "birthday_wish" | "announcement" | "welcome" | "trial_followup";
  body: string;
  variables: string[]; // placeholders like {{student_name}}, {{amount}}
  isActive: boolean;
}

// Pre-built message templates (WhatsApp Business API format)
export const MESSAGE_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "fee_reminder",
    name: "Fee Reminder",
    category: "fee_reminder",
    body: "💰 Fee Reminder\n\nDear {{parent_name}},\n\nThis is a reminder that {{student_name}}'s fee of ₹{{amount}} for {{month}} is pending.\n\nPlease pay at your earliest convenience.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "amount", "month", "academy_name"],
    isActive: true,
  },
  {
    id: "attendance_alert",
    name: "Attendance Alert",
    category: "attendance_alert",
    body: "⚠️ Attendance Alert\n\nDear {{parent_name}},\n\n{{student_name}} was marked absent today ({{date}}) from {{batch_name}}.\n\nIf this is unexpected, please contact us.\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "date", "batch_name", "academy_name"],
    isActive: true,
  },
  {
    id: "birthday_wish",
    name: "Birthday Wish",
    category: "birthday_wish",
    body: "🎂 Happy Birthday!\n\nDear {{parent_name}},\n\nWishing {{student_name}} a very Happy Birthday! 🎉\n\nAs a birthday treat, enjoy 10% off this month's fee!\n\nUse code: BDAY10\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "academy_name"],
    isActive: true,
  },
  {
    id: "welcome",
    name: "Welcome Message",
    category: "welcome",
    body: "🏆 Welcome to {{academy_name}}!\n\nDear {{parent_name}},\n\n{{student_name}} has been enrolled in {{batch_name}}.\n\nSchedule: {{schedule}}\nCoach: {{coach_name}}\n\nWe're excited to have you! 🌟\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "batch_name", "schedule", "coach_name", "academy_name"],
    isActive: true,
  },
  {
    id: "trial_followup",
    name: "Trial Follow-up",
    category: "trial_followup",
    body: "👋 Hi {{parent_name}},\n\nThank you for attending the trial session at {{academy_name}}!\n\nWe'd love to have {{student_name}} join us. Here's what you get:\n\n✅ Professional coaching\n✅ Age-appropriate training\n✅ Progress tracking\n\nEnroll now and get ₹500 off the first month!\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "academy_name"],
    isActive: true,
  },
  {
    id: "progress_report",
    name: "Monthly Progress Report",
    category: "announcement",
    body: "📊 Monthly Report\n\nDear {{parent_name}},\n\n{{student_name}}'s report for {{month}}:\n\n🎯 Technique: {{technique}}/5\n💪 Fitness: {{fitness}}/5\n🏅 Discipline: {{discipline}}/5\n📈 Attendance: {{attendance}}%\n\nCoach Notes: {{notes}}\n\n— {{academy_name}}",
    variables: ["parent_name", "student_name", "month", "technique", "fitness", "discipline", "attendance", "notes", "academy_name"],
    isActive: true,
  },
];

// Helper to fill template variables
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// Generate wa.me link (fallback when API not configured)
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const fullPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
