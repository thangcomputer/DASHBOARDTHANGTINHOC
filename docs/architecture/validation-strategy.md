# Validation Strategy — Phase 3

## Requirements
The ARB dictates that validation must **NOT** exist inside Controllers, Repositories, or Routes. Validation belongs exclusively to the DTO layer, ensuring that Application Services only ever receive guaranteed valid objects.

## Evaluation of Validation Frameworks

1. **`express-validator`**:
   - **Pros**: Easy middleware integration.
   - **Cons**: Ties validation directly to the Express `req/res` cycle. Violates the rule that validation belongs in the DTO layer, independent of transport.
   - **Verdict**: ❌ Rejected.

2. **`Joi`**:
   - **Pros**: Powerful, established ecosystem.
   - **Cons**: Syntax can be verbose. Lacks built-in first-class TypeScript inference (though this is currently a JS project, future-proofing is ideal).
   - **Verdict**: ⚠️ Plausible, but older.

3. **`class-validator`**:
   - **Pros**: Works perfectly with classes (DTOs) via decorators. Highly readable.
   - **Cons**: Requires `reflect-metadata` and decorators, which are non-standard in plain JS without Babel/TypeScript.
   - **Verdict**: ⚠️ Plausible, but requires transpilation setup for decorators.

4. **`Zod`**:
   - **Pros**: Transport-agnostic. Schema declaration is highly readable. Can validate plain objects directly (perfect for mapping `data.body` to a DTO). First-class type inference if TS is ever adopted.
   - **Cons**: Slightly different paradigm (schema parsing vs class instantiation).
   - **Verdict**: ✅ Recommended.

## Recommended Strategy: Zod

### Implementation Plan (For Next Sprint)
1. Define a Zod schema for every Command/Query DTO.
2. Inside the Application Service (or a thin Mapper Layer), invoke `Schema.parse(payload)`.
3. If parsing fails, it throws a standard `ValidationError` that the Controller safely catches and maps to a `400 Bad Request`.
4. If parsing succeeds, the Service proceeds with a guaranteed safe payload.

### Example (Conceptual Only)
```javascript
// DTO Layer
const CreateStudentSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional()
});

// Service Layer
async createStudent(data) {
  const validDTO = CreateStudentSchema.parse(data.body);
  // validDTO is now safe to use
}
```
