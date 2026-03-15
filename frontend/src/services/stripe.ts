import { Platform } from 'react-native';

// Only export Stripe functions on native platforms
export const useStripeHook = () => {
  if (Platform.OS === 'web') {
    return {
      initPaymentSheet: null,
      presentPaymentSheet: null,
    };
  }
  
  // Dynamic require for native only
  const { useStripe } = require('@stripe/stripe-react-native');
  return useStripe();
};

export const StripeProviderWrapper = Platform.OS !== 'web' 
  ? require('@stripe/stripe-react-native').StripeProvider 
  : null;
