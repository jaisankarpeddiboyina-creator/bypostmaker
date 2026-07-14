@@
-import { blogPosts } from '../../config/blog'
+import { blogPosts } from '../../config/blog'
+import { findMatchingRoute } from '../../config/routeRegistry'
@@
-      if (
-        !path.startsWith('/api/') &&
-        (path.startsWith('/blog') ||
-         path === '/privacy' ||
-         path === '/terms' ||
-         path === '/refund' ||
-         path === '/cookies' ||
-         path === '/shipping' ||
-         path === '/contact')
-      ) {
-        return handleStaticPageSEO(request, env)
-      }
+      if (
+        !path.startsWith('/api/') &&
+        (path.startsWith('/blog') ||
+         findMatchingRoute(path) ||
+         path === '/privacy' ||
+         path === '/terms' ||
+         path === '/refund' ||
+         path === '/cookies' ||
+         path === '/shipping' ||
+         path === '/contact')
+      ) {
+        return handleStaticPageSEO(request, env)
+      }
