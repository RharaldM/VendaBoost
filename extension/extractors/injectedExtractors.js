/**
 * VendaBoost Extension - Injected Extractors
 * Scripts especializados para injeção em tabs invisíveis
 * Executam no contexto da página (onde document/window existem)
 */

/**
 * Extract session data from page context
 */
function extractSessionFromPage() {
  return new Promise(async (resolve) => {
    try {
      console.log('🔍 VendaBoost: Extracting session data from page context');
      
      const sessionData = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        source: 'injected_extractor',
        extractionMethod: 'page_context'
      };
      
      // Extract user information
      sessionData.userInfo = extractUserInfoFromPage();
      sessionData.userId = sessionData.userInfo.id;
      
      // Extract localStorage
      sessionData.localStorage = extractLocalStorageData();
      
      // Extract sessionStorage  
      sessionData.sessionStorage = extractSessionStorageData();
      
      // Extract metadata
      sessionData.metadata = extractPageMetadata();
      
      // Note: Cookies will be extracted by background script
      sessionData.cookiesNote = 'Cookies extracted by background script';
      
      console.log('✅ VendaBoost: Session data extracted from page', {
        userId: sessionData.userId,
        url: sessionData.url
      });
      
      resolve(sessionData);
      
    } catch (error) {
      console.error('❌ VendaBoost: Session extraction error:', error);
      resolve(null);
    }
  });
}

/**
 * Extract user info from page
 */
function extractUserInfoFromPage() {
  const userInfo = {
    id: '',
    name: '',
    email: '',
    profileUrl: '',
    avatarUrl: '',
    extractionMethods: []
  };

  try {
    // Method 1: From cookies
    const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
    if (cUserCookie) {
      userInfo.id = cUserCookie.split('=')[1].trim();
      userInfo.extractionMethods.push('cookie');
    }

    // Method 2: From page scripts
    if (!userInfo.id) {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        
        const patterns = [
          /"USER_ID":"(\d+)"/,
          /"userID":"(\d+)"/,
          /"actorID":"(\d+)"/,
          /"viewerID":"(\d+)"/
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            userInfo.id = match[1];
            userInfo.extractionMethods.push('scripts');
            break;
          }
        }
        
        if (userInfo.id) break;
      }
    }

    // Method 3: From meta tags
    if (!userInfo.id) {
      const metaUserId = document.querySelector('meta[property="al:ios:url"]');
      if (metaUserId) {
        const content = metaUserId.getAttribute('content');
        if (content) {
          const match = content.match(/profile\/(\d+)/);
          if (match) {
            userInfo.id = match[1];
            userInfo.extractionMethods.push('meta');
          }
        }
      }
    }

    // Extract user name
    const nameSelectors = [
      '[role="banner"] h1',
      'div[role="main"] h1', 
      'a[href*="/profile"] span',
      'div[role="banner"] div[dir="auto"] > span',
      'div[role="main"] div[dir="auto"] h1',
      'div[aria-label] h1 span'
    ];
    
    for (const selector of nameSelectors) {
      const nameElement = document.querySelector(selector);
      if (nameElement && nameElement.textContent) {
        const name = nameElement.textContent.trim();
        if (name && name.length > 0 && name.length < 100 && !name.includes('Facebook')) {
          userInfo.name = name;
          break;
        }
      }
    }

    // Build profile URL
    if (userInfo.id) {
      userInfo.profileUrl = `https://www.facebook.com/profile.php?id=${userInfo.id}`;
    }

    // Extract avatar
    const avatarImg = document.querySelector('[data-pagelet="ProfileActions"] img, [role="banner"] img[src*="profile"]');
    if (avatarImg) {
      userInfo.avatarUrl = avatarImg.src;
    }

    return userInfo;

  } catch (error) {
    console.error('Error extracting user info:', error);
    return userInfo;
  }
}

/**
 * Extract localStorage data
 */
function extractLocalStorageData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !isSensitiveKey(key)) {
        data[key] = localStorage.getItem(key);
      }
    }
  } catch (error) {
    console.error('Error accessing localStorage:', error);
  }
  return data;
}

/**
 * Extract sessionStorage data
 */
function extractSessionStorageData() {
  const data = {};
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && !isSensitiveKey(key)) {
        data[key] = sessionStorage.getItem(key);
      }
    }
  } catch (error) {
    console.error('Error accessing sessionStorage:', error);
  }
  return data;
}

/**
 * Check if key contains sensitive data
 */
function isSensitiveKey(key) {
  const sensitivePatterns = ['password', 'token', 'secret', 'auth', 'credential', 'private', 'key'];
  const lowerKey = key.toLowerCase();
  return sensitivePatterns.some(pattern => lowerKey.includes(pattern));
}

/**
 * Extract page metadata
 */
function extractPageMetadata() {
  return {
    pageTitle: document.title,
    pageUrl: window.location.href,
    referrer: document.referrer,
    language: navigator.language,
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    cookiesEnabled: navigator.cookieEnabled,
    onlineStatus: navigator.onLine,
    pageLoadTime: performance.timing ? 
      performance.timing.loadEventEnd - performance.timing.navigationStart : 0
  };
}

/**
 * Check if user is logged in (page context)
 */
function checkIfLoggedInOnPage() {
  try {
    // Multiple ways to check if logged in
    const hasUserCookie = document.cookie.includes('c_user=');
    
    const hasProfileElements = !!(
      document.querySelector('[role="banner"]') ||
      document.querySelector('[data-pagelet="ProfileActions"]') ||
      document.querySelector('div[role="main"]') ||
      document.querySelector('a[href*="/me/"]')
    );
    
    const hasNavElements = !!(
      document.querySelector('a[href="/"]') ||
      document.querySelector('div[role="navigation"]') ||
      document.querySelector('[aria-label="Facebook"]')
    );
    
    const notOnLoginPage = !window.location.pathname.includes('/login') && 
                           !window.location.pathname.includes('/reg');
    
    return hasUserCookie || (hasProfileElements && notOnLoginPage) || (hasNavElements && notOnLoginPage);
    
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
}

/**
 * Extract groups from groups page with smart scrolling
 */
function extractGroupsFromGroupsPage(config = {}) {
  return new Promise(async (resolve) => {
    try {
      console.log('🕵️ VendaBoost: Starting groups extraction on page');
      
      // Wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const groups = [];
      let scrollAttempts = 0;
      const maxScrollAttempts = config.maxScrollAttempts || 15;
      const scrollDelay = config.scrollDelay || 2000;
      
      // Function to extract visible groups
      const extractVisibleGroups = () => {
        const groupSelectors = [
          'a[href*="/groups/"][role="link"]',
          '[data-testid*="group"] a[href*="/groups/"]',
          'div[role="article"] a[href*="/groups/"]',
          'a[href*="/groups/"] div[dir="auto"]',
          '[data-pagelet*="GroupsDiscover"] a[href*="/groups/"]',
          '[data-pagelet*="GroupsSidebar"] a[href*="/groups/"]'
        ];
        
        const currentGroups = [];
        
        for (const selector of groupSelectors) {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(element => {
            try {
              const groupData = {
                id: '',
                name: '',
                url: element.href || element.closest('a')?.href || '',
                memberCount: 0,
                privacy: 'unknown',
                description: '',
                coverPhoto: '',
                extractedAt: new Date().toISOString(),
                source: 'page_injection'
              };
              
              // Extract ID from URL
              if (groupData.url) {
                const urlObj = new URL(groupData.url);
                const idMatch = urlObj.pathname.match(/\/groups\/(\d+)/);
                if (idMatch) {
                  groupData.id = idMatch[1];
                } else {
                  const nameMatch = urlObj.pathname.match(/\/groups\/([^\/\?]+)/);
                  if (nameMatch && nameMatch[1] !== 'feed' && nameMatch[1] !== 'browse') {
                    groupData.id = nameMatch[1];
                  }
                }
              }
              
              // Extract name
              const nameElement = element.querySelector('[dir="auto"]') || 
                                 element.querySelector('span') ||
                                 element;
              const name = nameElement.textContent?.trim() || '';
              
              if (name && name.length > 0 && name.length < 200) {
                groupData.name = name;
              }
              
              // Extract member count and privacy from parent elements
              const parentElement = element.closest('[role="article"]') || 
                                  element.closest('div') ||
                                  element.parentElement;
              
              if (parentElement) {
                const text = parentElement.textContent || '';
                
                // Member count
                const memberMatch = text.match(/(\d+(?:[,\.]\d+)*)\s*(?:member|membro)/i);
                if (memberMatch) {
                  groupData.memberCount = parseInt(memberMatch[1].replace(/[,\.]/g, ''));
                }
                
                // Privacy
                if (text.toLowerCase().includes('private') || text.toLowerCase().includes('privado')) {
                  groupData.privacy = 'private';
                } else if (text.toLowerCase().includes('public') || text.toLowerCase().includes('público')) {
                  groupData.privacy = 'public';
                }
              }
              
              // Extract cover photo
              const imgElement = element.querySelector('img') || 
                               element.closest('div').querySelector('img');
              if (imgElement && imgElement.src && !imgElement.src.includes('data:')) {
                groupData.coverPhoto = imgElement.src;
              }
              
              // Only add valid groups (with ID and name)
              if (groupData.id && groupData.name && groupData.url) {
                currentGroups.push(groupData);
              }
              
            } catch (error) {
              console.debug('Error extracting group element:', error);
            }
          });
        }
        
        return currentGroups;
      };
      
      // Initial extraction
      let currentGroups = extractVisibleGroups();
      groups.push(...currentGroups);
      
      console.log(`🔍 Initial groups extracted: ${currentGroups.length}`);
      
      // Scroll and extract more
      let lastScrollPosition = 0;
      let noNewContentCount = 0;
      
      while (scrollAttempts < maxScrollAttempts) {
        // Perform scroll
        const currentScroll = window.pageYOffset;
        const documentHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        
        if (config.humanLikeScrolling) {
          // Human-like scrolling
          const scrollAmount = viewportHeight * (0.6 + Math.random() * 0.3);
          const targetScroll = Math.min(currentScroll + scrollAmount, documentHeight - viewportHeight);
          
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
        } else {
          window.scrollBy(0, viewportHeight);
        }
        
        scrollAttempts++;
        
        // Wait for scroll and content loading
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait for content
        
        // Check if actually scrolled
        const newScrollPosition = window.pageYOffset;
        if (newScrollPosition === lastScrollPosition) {
          noNewContentCount++;
          if (noNewContentCount >= 3) {
            console.log('🏁 No more content, stopping scroll');
            break;
          }
        } else {
          noNewContentCount = 0;
        }
        lastScrollPosition = newScrollPosition;
        
        // Extract new groups
        const newGroups = extractVisibleGroups();
        
        // Filter duplicates
        const uniqueNewGroups = newGroups.filter(newGroup => 
          !groups.some(existingGroup => 
            existingGroup.id === newGroup.id || 
            (existingGroup.url === newGroup.url && newGroup.url)
          )
        );
        
        groups.push(...uniqueNewGroups);
        
        console.log(`📜 Scroll ${scrollAttempts}: +${uniqueNewGroups.length} new groups (total: ${groups.length})`);
        
        // Stop if no new groups for consecutive attempts
        if (uniqueNewGroups.length === 0) {
          noNewContentCount++;
          if (noNewContentCount >= 2) {
            console.log('🏁 No new groups found, stopping');
            break;
          }
        }
        
        // Check if reached end
        if (newScrollPosition + viewportHeight >= documentHeight - 200) {
          console.log('🏁 Reached end of page');
          break;
        }
      }
      
      console.log(`✅ Groups extraction completed: ${groups.length} groups total`);
      resolve(groups);
      
    } catch (error) {
      console.error('❌ Groups extraction error:', error);
      resolve([]);
    }
  });
}

/**
 * Extract profile data from profile page context
 */
function extractProfileFromPage() {
  return new Promise(async (resolve) => {
    try {
      console.log('🔍 VendaBoost: Extracting profile data from page context');
      
      // Wait for profile to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const profileData = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        source: 'injected_profile_extractor',
        extractionMethod: 'page_context'
      };
      
      // Extract user info
      profileData.userInfo = extractUserInfoFromPage();
      profileData.userId = profileData.userInfo.id;
      
      // Extract basic profile info
      profileData.basicInfo = extractBasicProfileInfo();
      
      // Extract contact info (public only)
      profileData.contactInfo = extractPublicContactInfo();
      
      // Extract work/education (public only)
      profileData.workEducation = extractPublicWorkEducation();
      
      console.log('✅ VendaBoost: Profile data extracted', {
        userId: profileData.userId,
        hasBasicInfo: !!profileData.basicInfo.name
      });
      
      resolve(profileData);
      
    } catch (error) {
      console.error('❌ Profile extraction error:', error);
      resolve(null);
    }
  });
}

/**
 * Extract basic profile information
 */
function extractBasicProfileInfo() {
  const basicInfo = {
    name: '',
    profilePicture: '',
    coverPhoto: '',
    bio: '',
    location: '',
    verificationStatus: false
  };

  try {
    // Extract name
    const nameSelectors = [
      'h1[dir="auto"]',
      '[data-pagelet="ProfileActions"] h1',
      'div[role="main"] h1'
    ];
    
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const name = element.textContent.trim();
        if (name && !name.includes('Facebook')) {
          basicInfo.name = name;
          break;
        }
      }
    }

    // Extract profile picture
    const profilePicSelectors = [
      '[data-testid="profile_picture"] img',
      'svg[data-testid="profile_picture"] + div img'
    ];
    
    for (const selector of profilePicSelectors) {
      const img = document.querySelector(selector);
      if (img && img.src) {
        basicInfo.profilePicture = img.src;
        break;
      }
    }

    // Extract cover photo
    const coverPhotoSelectors = [
      '[data-pagelet="ProfileCover"] img',
      'img[data-imgperflogname="profileCoverPhoto"]'
    ];
    
    for (const selector of coverPhotoSelectors) {
      const img = document.querySelector(selector);
      if (img && img.src) {
        basicInfo.coverPhoto = img.src;
        break;
      }
    }

    // Extract bio
    const bioSelectors = [
      '[data-testid="profile_bio"]',
      '[data-pagelet="ProfileTilesFeed"] div[dir="auto"]'
    ];
    
    for (const selector of bioSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const bio = element.textContent.trim();
        if (bio && bio.length > 10 && bio.length < 500) {
          basicInfo.bio = bio;
          break;
        }
      }
    }

    // Check verification status
    const verificationIndicators = [
      '[aria-label*="verified"]',
      '[data-testid*="verified"]'
    ];
    
    basicInfo.verificationStatus = verificationIndicators.some(selector => 
      document.querySelector(selector)
    );

    return basicInfo;

  } catch (error) {
    console.error('Error extracting basic profile info:', error);
    return basicInfo;
  }
}

/**
 * Extract public contact info
 */
function extractPublicContactInfo() {
  // Only extract publicly visible contact information
  const contactInfo = {
    website: '',
    socialLinks: []
  };

  try {
    // Extract website links
    const linkElements = document.querySelectorAll('a[href^="http"]:not([href*="facebook.com"])');
    linkElements.forEach(link => {
      if (link.href && link.textContent) {
        contactInfo.socialLinks.push({
          url: link.href,
          text: link.textContent.trim()
        });
      }
    });

    return contactInfo;
  } catch (error) {
    return contactInfo;
  }
}

/**
 * Extract public work/education info
 */
function extractPublicWorkEducation() {
  // Extract only publicly visible work and education
  const workEducation = {
    currentWork: [],
    education: []
  };

  // This would require more specific selectors based on Facebook's current layout
  // Implementation would go here for publicly visible work/education info

  return workEducation;
}

/**
 * Extract friends count if visible
 */
function extractFriendsCount() {
  try {
    const friendsSelectors = [
      'a[href*="/friends"] span',
      '[data-testid="friends_count"]'
    ];
    
    for (const selector of friendsSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent;
        const match = text.match(/(\d+(?:,\d+)*)/);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    }
    
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Check for anti-detection indicators
 */
function checkAntiDetectionIndicators() {
  try {
    const indicators = {
      rateLimitDetected: false,
      captchaPresent: false,
      securityCheckpoint: false,
      suspiciousActivity: false
    };
    
    const pageText = document.body.textContent.toLowerCase();
    
    // Check for rate limiting
    const rateLimitPatterns = [
      'rate limit',
      'too many requests', 
      'please slow down',
      'suspicious activity'
    ];
    
    indicators.rateLimitDetected = rateLimitPatterns.some(pattern => 
      pageText.includes(pattern)
    );
    
    // Check for captcha
    indicators.captchaPresent = !!(
      document.querySelector('[data-testid*="captcha"]') ||
      document.querySelector('.captcha') ||
      document.querySelector('#captcha')
    );
    
    // Check for security checkpoint
    indicators.securityCheckpoint = window.location.href.includes('checkpoint');
    
    return indicators;
    
  } catch (error) {
    return { error: error.message };
  }
}

// Export functions for injection
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractSessionFromPage,
    extractGroupsFromGroupsPage,
    extractProfileFromPage,
    checkIfLoggedInOnPage,
    checkAntiDetectionIndicators
  };
}