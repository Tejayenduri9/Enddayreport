import { onRequest as __generate_report_js_onRequest } from "/Users/tejayenduri/Desktop/Enddayreport/functions/generate-report.js"
import { onRequest as __send_feedback_js_onRequest } from "/Users/tejayenduri/Desktop/Enddayreport/functions/send-feedback.js"

export const routes = [
    {
      routePath: "/generate-report",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__generate_report_js_onRequest],
    },
  {
      routePath: "/send-feedback",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__send_feedback_js_onRequest],
    },
  ]