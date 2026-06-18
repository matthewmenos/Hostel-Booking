import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { managerApi } from "../api/endpoints.js";

export default function ManagerVerificationCallback() {
  const [verif, setVerif] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    managerApi.getVerification()
      .then(({ data }) => setVerif(data))
      .catch(() => setVerif(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8 text-center space-y-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        ) : verif?.payment_confirmed ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Payment Received!</h2>
            <p className="text-gray-500">
              Your identity verification application is now under review.
              An admin will approve your account within 1–2 business days.
            </p>
          </>
        ) : verif ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock size={32} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">Payment Pending</h2>
            <p className="text-gray-500">
              Your application was submitted but payment hasn't been confirmed yet.
              If you completed the Paystack checkout, it may take a few minutes to reflect.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <XCircle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold">No Application Found</h2>
            <p className="text-gray-500">
              We couldn't find a verification submission linked to your account.
            </p>
          </>
        )}

        <Link to="/manager" className="btn-primary inline-block px-6 py-2.5">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
