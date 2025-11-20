let currentSlide = 0;
let slideInterval;
let searchTimeout;
let isVideoPlaying = false;
let animationObserver;

document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeHeroSlider();
    initializeSearch();
    initializeVideoPlayer();
    initializeAnimations();
    initializeScrollEffects();
    initializeStatsCounter();
    initializeNewsletterForm();
    initializeMobileMenu();
    initializeUtilityFunctions();
});

function initializeNavigation() {
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    window.addEventListener('scroll', () => {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.clientHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}` || 
                (current === 'hero' && link.getAttribute('href') === 'index.html')) {
                link.classList.add('active');
            }
        });
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetSection = document.querySelector(href);
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

function initializeHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const indicators = document.querySelectorAll('.indicator');
    const heroSection = document.querySelector('.hero');
    
    if (slides.length === 0) return;
    
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        indicators[currentSlide].classList.remove('active');
        
        currentSlide = (currentSlide + 1) % slides.length;
        
        slides[currentSlide].classList.add('active');
        indicators[currentSlide].classList.add('active');
    }
    
    function startSlider() {
        slideInterval = setInterval(nextSlide, 5000);
    }
    
    function stopSlider() {
        clearInterval(slideInterval);
    }
    
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            if (index === currentSlide) return;
            
            stopSlider();
            
            slides[currentSlide].classList.remove('active');
            indicators[currentSlide].classList.remove('active');
            
            currentSlide = index;
            
            slides[currentSlide].classList.add('active');
            indicators[currentSlide].classList.add('active');
            
            setTimeout(startSlider, 1000);
        });
    });
    
    heroSection.addEventListener('mouseenter', stopSlider);
    heroSection.addEventListener('mouseleave', startSlider);
    
    startSlider();
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            stopSlider();
            currentSlide = currentSlide === 0 ? slides.length - 1 : currentSlide - 1;
            updateSlide();
            setTimeout(startSlider, 1000);
        } else if (e.key === 'ArrowRight') {
            stopSlider();
            nextSlide();
            setTimeout(startSlider, 1000);
        }
    });
    
    function updateSlide() {
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === currentSlide);
        });
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentSlide);
        });
    }
}

function initializeSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchDropdown = document.getElementById('search-dropdown');
    const searchInput = document.getElementById('search-input');
    const searchSubmit = document.getElementById('search-submit');
    
    if (!searchBtn || !searchDropdown || !searchInput) return;
    
    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSearchDropdown();
    });
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length > 2) {
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        }
    });
    
    searchSubmit.addEventListener('click', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            performSearch(query);
            closeSearchDropdown();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!searchDropdown.contains(e.target) && !searchBtn.contains(e.target)) {
            closeSearchDropdown();
        }
    });
    
    function startSearchTimer() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            closeSearchDropdown();
        }, 10000);
    }
    
    function toggleSearchDropdown() {
        const isActive = searchDropdown.classList.contains('active');
        if (isActive) {
            closeSearchDropdown();
        } else {
            openSearchDropdown();
        }
    }
    
    function openSearchDropdown() {
        searchDropdown.classList.add('active');
        searchInput.focus();
        startSearchTimer();
    }
    
    function closeSearchDropdown() {
        searchDropdown.classList.remove('active');
        clearTimeout(searchTimeout);
    }
    
    function performSearch(query) {
        console.log(`Searching for: ${query}`);
    
        const searchableContent = [
            { title: 'Assignment Review', url: 'services.html#assignment-review' },
            { title: 'Dissertation Support', url: 'services.html#dissertation' },
            { title: 'Personal Tutoring', url: 'services.html#tutoring' },
            { title: 'About Us', url: 'about.html' },
            { title: 'Portfolio', url: 'portfolio.html' },
            { title: 'Resources', url: 'resources.html' }
        ];
        
        const results = searchableContent.filter(item => 
            item.title.toLowerCase().includes(query.toLowerCase())
        );
        
        if (results.length > 0) {
            window.location.href = results[0].url;
        } else {
            showNotification('No results found for your search.', 'info');
        }
    }
}

function initializeVideoPlayer() {
    const playBtn = document.getElementById('play-btn');
    const videoPlayer = document.getElementById('video-player');
    const videoPlaceholder = document.querySelector('.video-placeholder');
    
    if (!playBtn || !videoPlayer) return;
    
    playBtn.addEventListener('click', () => {
        if (!isVideoPlaying) {
            videoPlaceholder.style.display = 'none';
            videoPlayer.style.display = 'block';
            videoPlayer.play();
            isVideoPlaying = true;
            trackVideoPlay();
        }
    });
    videoPlayer.addEventListener('ended', () => {
        videoPlaceholder.style.display = 'block';
        videoPlayer.style.display = 'none';
        isVideoPlaying = false;
        trackVideoComplete();
    });
    
    videoPlayer.addEventListener('error', () => {
        showNotification('Error loading video. Please try again later.', 'error');
        videoPlaceholder.style.display = 'block';
        videoPlayer.style.display = 'none';
        isVideoPlaying = false;
    });
}

function initializeAnimations() {
    animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                
                if (entry.target.classList.contains('stat-card')) {
                    animateStatNumber(entry.target);
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    const animatableElements = document.querySelectorAll(
        '.service-card, .testimonial-card, .stat-card, .founder-card, .video-content'
    );
    
    animatableElements.forEach(el => {
        animationObserver.observe(el);
    });
}

function initializeScrollEffects() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        
        if (hero && scrolled < hero.offsetHeight) {
            const parallaxSpeed = scrolled * 0.5;
            hero.style.transform = `translateY(${parallaxSpeed}px)`;
        }
    });
    
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const nextSection = document.querySelector('.services-preview');
            if (nextSection) {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset;
        const scrollToTop = document.querySelector('.scroll-to-top');
        
        if (scrollToTop) {
            if (scrollTop > 500) {
                scrollToTop.classList.add('visible');
            } else {
                scrollToTop.classList.remove('visible');
            }
        }
    });
}

function initializeStatsCounter() {
    let countersAnimated = false;
    
    function animateStatNumber(statCard) {
        if (countersAnimated) return;
        
        const statNumber = statCard.querySelector('.stat-number');
        if (!statNumber) return;
        
        const target = parseInt(statNumber.getAttribute('data-target'));
        const duration = 2000; 
        const step = target / (duration / 16); 
        let current = 0;
        
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            const displayNumber = target > 999 ? 
                Math.floor(current).toLocaleString() : 
                Math.floor(current);
            
            statNumber.textContent = displayNumber;
        }, 16);
    }
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !countersAnimated) {
                    countersAnimated = true;
                    const statCards = document.querySelectorAll('.stat-card');
                    statCards.forEach((card, index) => {
                        setTimeout(() => {
                            animateStatNumber(card);
                        }, index * 200);
                    });
                }
            });
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }
}

function initializeNewsletterForm() {
    const newsletterForm = document.getElementById('newsletter-form');
    const newsletterInput = newsletterForm?.querySelector('.newsletter-input');
    const newsletterBtn = newsletterForm?.querySelector('.newsletter-btn');
    
    if (!newsletterForm) return;
    
    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = newsletterInput.value.trim();
        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }
        
        const originalBtnContent = newsletterBtn.innerHTML;
        newsletterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
        newsletterBtn.disabled = true;
        
        try {
            await simulateNewsletterSubscription(email);
            
            showNotification('Successfully subscribed to our newsletter!', 'success');
            newsletterInput.value = '';
            
            trackNewsletterSubscription(email);
            
        } catch (error) {
            showNotification('Subscription failed. Please try again.', 'error');
            console.error('Newsletter subscription error:', error);
        } finally {
            newsletterBtn.innerHTML = originalBtnContent;
            newsletterBtn.disabled = false;
        }
    });
}

function initializeMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (!hamburger || !navMenu) return;
    
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

function initializeUtilityFunctions() {
    initializeTooltips();
    initializeLazyLoading();
    initializeFormValidation();
    initializeSocialTracking();
    initializePerformanceMonitoring();
}

function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function initializeLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => imageObserver.observe(img));
    }
}

function initializeFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input[required]');
        
        inputs.forEach(input => {
            input.addEventListener('blur', validateInput);
            input.addEventListener('input', clearValidationError);
        });
    });
}

function initializeSocialTracking() {
    const socialLinks = document.querySelectorAll('.founder-btn, .social-link');
    
    socialLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const platform = link.classList.contains('whatsapp') ? 'WhatsApp' :
                           link.classList.contains('linkedin') ? 'LinkedIn' :
                           link.classList.contains('cv') ? 'CV Download' :
                           link.className.match(/social-link (\w+)/)?.[1] || 'Unknown';
            
            trackSocialClick(platform);
        });
    });
}

function initializePerformanceMonitoring() {
    window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
        if (loadTime > 3000) {
            console.warn('Page load time is slow:', loadTime);
        }
    });
    
    let ticking = false;
    
    function updateScrollPosition() {
        ticking = false;
    }
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateScrollPosition);
            ticking = true;
        }
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => removeNotification(notification), 5000);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notification);
    });
}

function removeNotification(notification) {
    notification.classList.add('hide');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function validateInput(e) {
    const input = e.target;
    const value = input.value.trim();
    
    clearValidationError(input);
    
    if (input.type === 'email' && value && !isValidEmail(value)) {
        showInputError(input, 'Please enter a valid email address');
        return false;
    }
    
    if (input.hasAttribute('required') && !value) {
        showInputError(input, 'This field is required');
        return false;
    }
    
    return true;
}

function showInputError(input, message) {
    input.classList.add('error');
    
    let errorElement = input.parentNode.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        input.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
}

function clearValidationError(input) {
    if (typeof input === 'object' && input.target) {
        input = input.target;
    }
    
    input.classList.remove('error');
    const errorElement = input.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

function showTooltip(e) {
    const element = e.target;
    const tooltipText = element.getAttribute('data-tooltip');
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    
    element._tooltip = tooltip;
}

function hideTooltip(e) {
    const element = e.target;
    if (element._tooltip) {
        element._tooltip.remove();
        delete element._tooltip;
    }
}

function trackVideoPlay() {
    console.log('Video play tracked');
}

function trackVideoComplete() {
    console.log('Video completion tracked');
}

function trackNewsletterSubscription(email) {
    console.log('Newsletter subscription tracked:', email);
}

function trackSocialClick(platform) {
    console.log('Social click tracked:', platform);
}

async function simulateNewsletterSubscription(email) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.1) {
                resolve({ success: true, email });
            } else {
                reject(new Error('Subscription failed'));
            }
        }, 1500);
    });
}

window.addEventListener('error', (e) => {
    console.error('JavaScript error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

window.addEventListener('beforeunload', () => {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (animationObserver) {
        animationObserver.disconnect();
    }
});