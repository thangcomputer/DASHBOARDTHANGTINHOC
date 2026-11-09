import { createContext, useContext } from 'react';

export const SubscriptionContext = createContext(null);

/** { overview, subscription, refresh, openRenew } - null ngoài khu vực học viên. */
export function useStudentSubscription() {
  return useContext(SubscriptionContext);
}
