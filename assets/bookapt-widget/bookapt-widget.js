/**
 * BookAPT Booking Widget
 * Easy integration for businesses to add booking to their website
 * Version: 1.0.0
 */

(function() {
  'use strict';

  // Configuration
  const WIDGET_VERSION = '1.0.0';
  const isLocalDev = typeof window !== 'undefined' && window.location && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const API_BASE_URL = isLocalDev
    ? 'http://localhost:3000/api'
    : 'https://bookapt-payment-api.herokuapp.com/api';
  const WEB_APP_URL = isLocalDev
    ? 'http://localhost:3001'
    : 'https://app.bookapt.com';
  const MOBILE_APP_SCHEME = 'bookapt://';

  // Get business ID from script tag
  function getBusinessId() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const businessId = script.getAttribute('data-business-id');
      if (businessId) {
        return businessId;
      }
    }
    return null;
  }

  // Add widget CSS
  function addWidgetStyles() {
    if (document.getElementById('bookapt-widget-styles')) {
      return; // Already added
    }

    const style = document.createElement('style');
    style.id = 'bookapt-widget-styles';
    style.textContent = `
      .bookapt-widget-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        max-height: 600px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        overflow: hidden;
        animation: slideUp 0.3s ease-out;
      }
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      .bookapt-widget-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .bookapt-widget-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .bookapt-widget-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        line-height: 30px;
        transition: opacity 0.2s;
      }
      .bookapt-widget-close:hover {
        opacity: 0.7;
      }
      .bookapt-widget-content {
        padding: 20px;
        max-height: 500px;
        overflow-y: auto;
      }
      .bookapt-business-info {
        margin-bottom: 20px;
        text-align: center;
      }
      .bookapt-business-info h4 {
        margin: 0 0 8px 0;
        font-size: 20px;
        color: #333;
      }
      .bookapt-business-info p {
        margin: 0;
        color: #666;
        font-size: 14px;
      }
      .bookapt-services-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bookapt-service-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        transition: background 0.2s;
      }
      .bookapt-service-item:hover {
        background: #e9ecef;
      }
      .service-name {
        font-weight: 500;
        color: #333;
        flex: 1;
      }
      .service-price {
        color: #667eea;
        font-weight: 600;
        margin: 0 12px;
      }
      .book-btn {
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: background 0.2s;
      }
      .book-btn:hover {
        background: #5568d3;
      }
      .bookapt-widget-footer {
        text-align: center;
        padding: 10px;
        background: #f8f9fa;
        font-size: 12px;
        color: #666;
      }
      .bookapt-widget-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        border: none;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        font-weight: bold;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .bookapt-widget-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
      }
      .bookapt-widget-loading {
        text-align: center;
        padding: 40px 20px;
        color: #666;
      }
      .bookapt-widget-error {
        text-align: center;
        padding: 40px 20px;
        color: #dc3545;
      }
      @media (max-width: 768px) {
        .bookapt-widget-container {
          width: calc(100% - 40px);
          right: 20px;
          left: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Create widget HTML
  function createWidget(businessData) {
    const widgetId = 'bookapt-widget-' + Date.now();
    const widgetHTML = `
      <div id="${widgetId}" class="bookapt-widget-container">
        <div class="bookapt-widget-header">
          <h3>📅 Book Appointment</h3>
          <button class="bookapt-widget-close" onclick="document.getElementById('${widgetId}').remove()">×</button>
        </div>
        <div class="bookapt-widget-content">
          <div class="bookapt-business-info">
            <h4>${escapeHtml(businessData.businessName || 'Business')}</h4>
            <p>${escapeHtml(businessData.description || 'Book your appointment online')}</p>
          </div>
          <div class="bookapt-services-list">
            ${(businessData.services || []).map(service => `
              <div class="bookapt-service-item">
                <span class="service-name">${escapeHtml(service.name)}</span>
                <span class="service-price">$${service.price || 0}</span>
                <button class="book-btn" onclick="bookaptWidget.bookService('${service.id}', '${businessData.id}')">
                  Book
                </button>
              </div>
            `).join('')}
          </div>
          <div class="bookapt-widget-footer">
            <p>Powered by <strong>BookAPT</strong></p>
          </div>
        </div>
      </div>
    `;
    return widgetHTML;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load business data
  async function loadBusinessData(businessId) {
    try {
      const response = await fetch(`${API_BASE_URL}/business/${businessId}`);
      if (!response.ok) {
        throw new Error('Failed to load business data');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error loading business data:', error);
      return null;
    }
  }

  // Book service - redirects to BookAPT
  function bookService(serviceId, businessId) {
    // Check if mobile app is installed
    const mobileAppUrl = `${MOBILE_APP_SCHEME}book?businessId=${businessId}&serviceId=${serviceId}`;
    const webAppUrl = `${WEB_APP_URL}/book?businessId=${businessId}&serviceId=${serviceId}`;

    // Try to open mobile app first
    window.location.href = mobileAppUrl;
    
    // Fallback to web app after 2 seconds
    setTimeout(() => {
      window.open(webAppUrl, '_blank');
    }, 2000);
  }

  // Show widget
  async function showWidget() {
    const businessId = getBusinessId();
    if (!businessId) {
      console.error('BookAPT Widget: No business ID found');
      return;
    }

    // Remove existing widget
    const existing = document.querySelector('.bookapt-widget-container');
    if (existing) {
      existing.remove();
    }

    // Create loading widget
    const loadingId = 'bookapt-widget-loading-' + Date.now();
    const loadingHTML = `
      <div id="${loadingId}" class="bookapt-widget-container">
        <div class="bookapt-widget-header">
          <h3>📅 Book Appointment</h3>
          <button class="bookapt-widget-close" onclick="document.getElementById('${loadingId}').remove()">×</button>
        </div>
        <div class="bookapt-widget-content">
          <div class="bookapt-widget-loading">Loading...</div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);

    // Load business data
    const businessData = await loadBusinessData(businessId);
    
    // Remove loading widget
    document.getElementById(loadingId).remove();

    if (!businessData || !businessData.success) {
      const errorHTML = `
        <div class="bookapt-widget-container">
          <div class="bookapt-widget-header">
            <h3>📅 Book Appointment</h3>
            <button class="bookapt-widget-close" onclick="this.closest('.bookapt-widget-container').remove()">×</button>
          </div>
          <div class="bookapt-widget-content">
            <div class="bookapt-widget-error">
              Unable to load booking information. Please try again later.
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', errorHTML);
      return;
    }

    // Create and show widget
    const widgetHTML = createWidget(businessData);
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  // Initialize widget
  function initWidget() {
    const businessId = getBusinessId();
    if (!businessId) {
      console.error('BookAPT Widget: No business ID found. Add data-business-id attribute to script tag.');
      return;
    }

    // Add styles
    addWidgetStyles();

    // Create floating button
    const button = document.createElement('button');
    button.className = 'bookapt-widget-button';
    button.innerHTML = '📅';
    button.setAttribute('aria-label', 'Book Appointment');
    button.onclick = showWidget;

    document.body.appendChild(button);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  // Expose widget API
  window.bookaptWidget = {
    bookService: bookService,
    showWidget: showWidget,
    init: initWidget
  };

})();


