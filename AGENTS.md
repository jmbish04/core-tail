# Agent Guidelines for Core-Tail Development

## UI/UX Standards

### No Browser Alerts Policy

**CRITICAL RULE:** It is **NEVER** acceptable to use browser `alert()`, `confirm()`, or `prompt()` dialogs in this codebase.

**Why:** Browser alerts:
- Block the entire UI and JavaScript execution
- Cannot be styled to match the application theme
- Provide poor user experience
- Are not accessible
- Look unprofessional

**Instead, ALWAYS use shadcn/ui components:**

1. **For notifications and feedback:** Use the custom Toast component (`src/frontend/components/ui/toast.tsx`)
   ```tsx
   import { useToast } from "./ui/toast";

   const { addToast } = useToast();

   addToast({
     title: "Success!",
     description: "Operation completed successfully",
     variant: "success",
     duration: 3000,
   });
   ```

2. **For confirmations:** Use AlertDialog component (`src/frontend/components/ui/alert-dialog.tsx`)
   ```tsx
   import {
     AlertDialog,
     AlertDialogAction,
     AlertDialogCancel,
     AlertDialogContent,
     AlertDialogDescription,
     AlertDialogFooter,
     AlertDialogHeader,
     AlertDialogTitle,
   } from "./ui/alert-dialog";
   ```

3. **For input prompts:** Use Dialog or Popover components with Input fields

### Toast Variants

The Toast component supports these variants:
- `success`: Green, for successful operations
- `error`: Red, for errors and failures
- `warning`: Yellow, for warnings
- `info`: Blue, for informational messages
- `default`: Standard theme colors

### Copy to Clipboard Pattern

Always provide user feedback when copying to clipboard:

```tsx
const handleCopy = () => {
  navigator.clipboard
    .writeText(content)
    .then(() => {
      addToast({
        title: "Copied!",
        description: "Content copied to clipboard",
        variant: "success",
        duration: 2000,
      });
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      addToast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "error",
        duration: 3000,
      });
    });
};
```

## Development Best Practices

### Component Structure
- Use TypeScript for all React components
- Follow the existing shadcn/ui patterns
- Maintain consistent styling with Tailwind CSS
- Use lucide-react for icons

### Error Handling
- Always provide user-friendly error messages
- Log technical details to console for debugging
- Use toast notifications for user-facing errors
- Provide actionable next steps when possible

### Accessibility
- Include proper ARIA labels
- Ensure keyboard navigation works
- Maintain proper focus management
- Use semantic HTML elements

## Code Review Checklist

Before submitting code, verify:
- [ ] No usage of `alert()`, `confirm()`, or `prompt()`
- [ ] All user feedback uses shadcn components
- [ ] Error messages are user-friendly
- [ ] TypeScript types are properly defined
- [ ] Components are accessible
- [ ] Styling is consistent with the design system
