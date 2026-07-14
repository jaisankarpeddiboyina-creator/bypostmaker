@@
   const canonicalUrl = `${domain}${path}`
 
-  // 1. Resolve metadata for the route
-  let title = 'PostMaker — One prompt. Every platform. Download your kit.'
-  let description = 'Write one prompt. PostMaker generates platform-perfect posts for all 30+ social platforms and packages them into a ready-to-post content kit.'
-  let ogImage = `${domain}/og-image.svg`
-  let is404 = false
-
-  // Registry override: prefer ROUTE_REGISTRY when it matches the path.
-  const registryMatch = findMatchingRoute(path)
-  if (registryMatch) {
-    if (registryMatch.title) title = registryMatch.title
-    if (registryMatch.description) description = registryMatch.description
-    if (registryMatch.ogImage) ogImage = registryMatch.ogImage
-  } else {
-    // Existing behavior: blog-specific resolution, then exact staticRoutes table.
-    if (path.startsWith('/blog/')) {
-      const slug = path.substring(6)
-      const post = blogPosts.find(p => p.slug === slug)
-      if (post) {
-        title = `${post.title} | PostMaker Blog`
-        description = post.description
-        ogImage = post.ogImage || `${domain}/og-image.svg`
-      } else {
-        title = 'Post Not Found | PostMaker Blog'
-        description = 'The blog post you are looking for does not exist or has been moved.'
-        is404 = true
-      }
-    } else {
-      const staticRoutes: Record<string, { title: string; description: string }> = {
-        '/blog': {
-          title: 'PostMaker Blog — Social Media Tips, AI & Creation Strategy',
-          description: 'Learn how to multiply your reach, write perfect AI prompts, and optimize your social media strategy with PostMaker.'
-        },
-        '/privacy': {
-          title: 'Privacy Policy | PostMaker',
-          description: 'Read our privacy policy to understand how we collect, use, and protect your personal information.'
-        },
-        '/terms': {
-          title: 'Terms of Service | PostMaker',
-          description: 'Read our terms of service to understand your rights and responsibilities when using PostMaker.'
-        },
-        '/refund': {
-          title: 'Refund Policy | PostMaker',
-          description: 'Read our refund policy. We offer clear guidelines on refunds for our subscription plans.'
-        },
-        '/cookies': {
-          title: 'Cookie Policy | PostMaker',
-          description: 'Read our cookie policy to understand how we use cookies to improve your user experience.'
-        },
-        '/shipping': {
-          title: 'Shipping Policy | PostMaker',
-          description: 'Read our shipping policy details.'
-        },
-        '/contact': {
-          title: 'Contact Us | PostMaker',
-          description: 'Have questions or need help? Contact the PostMaker support team. We\'re here to assist you.'
-        }
-      }
-
-      const routeMeta = staticRoutes[path]
-      if (routeMeta) {
-        title = routeMeta.title
-        description = routeMeta.description
-      }
-    }
-  }
-
-  // Use registry-provided canonical if present; otherwise use domain+path (canonicalUrl).
-  let finalCanonicalUrl = canonicalUrl
-  if (registryMatch && registryMatch.canonical) finalCanonicalUrl = registryMatch.canonical
+  // 1. Resolve metadata for the route (defaults + registry override + existing fallbacks)
+  let title = 'PostMaker — One prompt. Every platform. Download your kit.'
+  let description = 'Write one prompt. PostMaker generates platform-perfect posts for all 30+ social platforms and packages them into a ready-to-post content kit.'
+  let ogImage = `${domain}/og-image.svg`
+  let is404 = false
+
+  // Registry override: prefer ROUTE_REGISTRY when it matches the path.
+  const registryMatch = findMatchingRoute(path)
+  if (registryMatch) {
+    if (registryMatch.title) title = registryMatch.title
+    if (registryMatch.description) description = registryMatch.description
+    if (registryMatch.ogImage) ogImage = registryMatch.ogImage
+  } else {
+    // Existing behavior: blog-specific resolution, then exact staticRoutes table.
+    if (path.startsWith('/blog/')) {
+      const slug = path.substring(6)
+      const post = blogPosts.find(p => p.slug === slug)
+      if (post) {
+        title = `${post.title} | PostMaker Blog`
+        description = post.description
+        ogImage = post.ogImage || `${domain}/og-image.svg`
+      } else {
+        title = 'Post Not Found | PostMaker Blog'
+        description = 'The blog post you are looking for does not exist or has been moved.'
+        is404 = true
+      }
+    } else {
+      const staticRoutes: Record<string, { title: string; description: string }> = {
+        '/blog': {
+          title: 'PostMaker Blog — Social Media Tips, AI & Creation Strategy',
+          description: 'Learn how to multiply your reach, write perfect AI prompts, and optimize your social media strategy with PostMaker.'
+        },
+        '/privacy': {
+          title: 'Privacy Policy | PostMaker',
+          description: 'Read our privacy policy to understand how we collect, use, and protect your personal information.'
+        },
+        '/terms': {
+          title: 'Terms of Service | PostMaker',
+          description: 'Read our terms of service to understand your rights and responsibilities when using PostMaker.'
+        },
+        '/refund': {
+          title: 'Refund Policy | PostMaker',
+          description: 'Read our refund policy. We offer clear guidelines on refunds for our subscription plans.'
+        },
+        '/cookies': {
+          title: 'Cookie Policy | PostMaker',
+          description: 'Read our cookie policy to understand how we use cookies to improve your user experience.'
+        },
+        '/shipping': {
+          title: 'Shipping Policy | PostMaker',
+          description: 'Read our shipping policy details.'
+        },
+        '/contact': {
+          title: 'Contact Us | PostMaker',
+          description: 'Have questions or need help? Contact the PostMaker support team. We\'re here to assist you.'
+        }
+      }
+
+      const routeMeta = staticRoutes[path]
+      if (routeMeta) {
+        title = routeMeta.title
+        description = routeMeta.description
+      }
+    }
+  }
+
+  // Use registry-provided canonical if present; otherwise use domain+path (canonicalUrl).
+  let finalCanonicalUrl = canonicalUrl
+  if (registryMatch && registryMatch.canonical) finalCanonicalUrl = registryMatch.canonical
@@
-    const rewriter = new HTMLRewriter()
-      .on('title', new MetaRewriter(title, description, canonicalUrl, ogImage))
-      .on('meta', new MetaRewriter(title, description, canonicalUrl, ogImage))
-      .on('link', new MetaRewriter(title, description, canonicalUrl, ogImage))
+    const rewriter = new HTMLRewriter()
+      .on('title', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
+      .on('meta', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
+      .on('link', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
