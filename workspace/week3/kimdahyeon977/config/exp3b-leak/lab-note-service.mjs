// Fixture: a service name the host does not provide, so nothing collides.
import { Service } from '@deepseek-ai/cordis'
export default class LabNote extends Service {
  constructor(ctx) { super(ctx, 'labNote') }
}
