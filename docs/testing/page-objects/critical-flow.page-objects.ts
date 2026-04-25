/**
 * KCAL Detox Page Object Model Taslakları
 *
 * Placeholder accessibilityID'leri gerçek bileşen id'leri ile değiştirilmelidir.
 * React Navigation 6 route geçişleri ve Zustand state etkileri testlerde bu POM üstünden yönetilir.
 */

import { by, element, expect } from "detox";

export class OnboardingScreen {
  heroCarousel = () => element(by.id("onboarding-hero-carousel"));
  ctaStart = () => element(by.id("onboarding-cta-start"));

  async swipeAllHeroes() {
    await this.heroCarousel().swipe("left");
    await this.heroCarousel().swipe("left");
    await this.heroCarousel().swipe("left");
  }
}

export class RegisterScreen {
  emailInput = () => element(by.id("auth-input-email"));
  passwordInput = () => element(by.id("auth-input-password"));
  submitButton = () => element(by.id("auth-submit-register"));
  emailErrorText = () => element(by.text("Geçerli bir e-posta adresi girin"));

  async register(email: string, password: string) {
    await this.emailInput().clearText();
    await this.emailInput().typeText(email);
    await this.passwordInput().typeText(password);
    await this.submitButton().tap();
  }
}

export class VerificationScreen {
  codeInput = () => element(by.id("auth-input-verification-code"));
  confirmButton = () => element(by.id("auth-submit-verification"));

  async submitCode(code: string) {
    await this.codeInput().typeText(code);
    await this.confirmButton().tap();
  }
}

export class NotificationPermissionScreen {
  allowButton = () => element(by.id("notifications-allow-button"));

  async allowNotifications() {
    await this.allowButton().tap();
  }
}

export class HomeScreen {
  screen = () => element(by.id("home-screen"));
  productCard = (index: number) => element(by.id(`product-card-${index}`));
  addButton = (index: number) => element(by.id(`product-card-add-button-${index}`));
}

export class FloatingCartPill {
  container = () => element(by.id("floating-cart-pill"));
  totalQty = () => element(by.id("floating-cart-pill-total-qty"));
  totalPrice = () => element(by.id("floating-cart-pill-total-price"));

  async goToCart() {
    await this.container().tap();
  }
}

export class ProductDetailScreen {
  screen = () => element(by.id("product-detail-screen"));
  totalAmount = () => element(by.id("product-detail-total-amount"));
  addToCartButton = () => element(by.id("product-detail-add-to-cart"));
  stepper = () => element(by.id("product-detail-stepper"));
  stepperMinus = () => element(by.id("product-detail-stepper-minus"));
  stepperPlus = () => element(by.id("product-detail-stepper-plus"));
  stepperQuantity = () => element(by.id("product-detail-stepper-quantity"));
  goToCartButton = () => element(by.id("product-detail-go-to-cart"));
  animatedNumberText = () => element(by.id("animated-number-text"));
}

export class CartScreen {
  screen = () => element(by.id("cart-screen"));
  totalQty = () => element(by.id("cart-total-qty"));
  totalPrice = () => element(by.id("cart-total-price"));
  checkoutButton = () => element(by.id("cart-checkout-button"));
}

export class CheckoutScreen {
  screen = () => element(by.id("checkout-screen"));
  addressSelector = () => element(by.id("checkout-address-selector"));
  addressOptionCesme = () => element(by.id("checkout-address-option-cesme"));
  deliveryMethodHome = () => element(by.id("delivery-method-home"));
  deliveryMethodPickup = () => element(by.id("delivery-method-pickup"));
  immediateOption = () => element(by.id("delivery-time-immediate-option"));
  scheduledOptionSelected = () => element(by.id("delivery-time-scheduled-option-selected"));
  zoneUnavailableBanner = () => element(by.text("Bu bölgeye teslimat yapılmıyor"));
  payButton = () => element(by.id("checkout-pay-button"));
}

export class PaymentScreen {
  webView = () => element(by.id("payment-webview"));
  // PayTR aktif olduğunda ayrı selector seti eklenebilir.
}

export class OrderConfirmScreen {
  screen = () => element(by.id("order-confirm-screen"));
}

export class ProfileOrdersScreen {
  screen = () => element(by.id("profile-orders-screen"));
  openOrderById = (orderId: string) => element(by.id(`profile-order-item-${orderId}`));
}

export class OrderDetailScreen {
  screen = () => element(by.id("order-detail-screen"));
  orderId = () => element(by.id("order-detail-id"));
}

export class CriticalFlowsApp {
  onboarding = new OnboardingScreen();
  register = new RegisterScreen();
  verification = new VerificationScreen();
  notificationPermission = new NotificationPermissionScreen();
  home = new HomeScreen();
  floatingCart = new FloatingCartPill();
  productDetail = new ProductDetailScreen();
  cart = new CartScreen();
  checkout = new CheckoutScreen();
  payment = new PaymentScreen();
  orderConfirm = new OrderConfirmScreen();
  profileOrders = new ProfileOrdersScreen();
  orderDetail = new OrderDetailScreen();

  async expectHomeVisible() {
    await expect(this.home.screen()).toBeVisible();
  }
}
