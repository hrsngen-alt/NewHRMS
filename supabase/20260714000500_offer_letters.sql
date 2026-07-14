-- =====================================================
-- Offer Letter Templates Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.offer_letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offer_letter_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage offer letter templates" ON public.offer_letter_templates;
CREATE POLICY "Admins manage offer letter templates" ON public.offer_letter_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- =====================================================
-- Offer Letters Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number TEXT UNIQUE,
  employee_id UUID REFERENCES public.employees(id),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_mobile TEXT,
  designation TEXT,
  department TEXT,
  reporting_manager TEXT,
  work_location TEXT,
  joining_date DATE,
  annual_ctc NUMERIC(15,2) DEFAULT 0,
  monthly_gross NUMERIC(15,2) DEFAULT 0,
  basic_salary NUMERIC(15,2) DEFAULT 0,
  hra NUMERIC(15,2) DEFAULT 0,
  special_allowance NUMERIC(15,2) DEFAULT 0,
  bonus NUMERIC(15,2) DEFAULT 0,
  other_allowances NUMERIC(15,2) DEFAULT 0,
  pf_employee NUMERIC(15,2) DEFAULT 0,
  esic NUMERIC(15,2) DEFAULT 0,
  gratuity NUMERIC(15,2) DEFAULT 0,
  professional_tax NUMERIC(15,2) DEFAULT 0,
  template_id UUID REFERENCES public.offer_letter_templates(id),
  rendered_html TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.employees(id),
  email_delivery_status TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expires_at DATE,
  notes TEXT,
  created_by UUID REFERENCES public.employees(id),
  updated_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage offer letters" ON public.offer_letters;
CREATE POLICY "Admins manage offer letters" ON public.offer_letters
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON public.offer_letters(status);
CREATE INDEX IF NOT EXISTS idx_offer_letters_created_at ON public.offer_letters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_letters_employee_id ON public.offer_letters(employee_id);

-- Auto-update updated_at for both tables
CREATE OR REPLACE FUNCTION update_offer_letters_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_offer_letters_updated_at ON public.offer_letters;
CREATE TRIGGER trg_offer_letters_updated_at
BEFORE UPDATE ON public.offer_letters
FOR EACH ROW EXECUTE FUNCTION update_offer_letters_updated_at();

DROP TRIGGER IF EXISTS trg_offer_letter_templates_updated_at ON public.offer_letter_templates;
CREATE TRIGGER trg_offer_letter_templates_updated_at
BEFORE UPDATE ON public.offer_letter_templates
FOR EACH ROW EXECUTE FUNCTION update_offer_letters_updated_at();

-- Default template
INSERT INTO public.offer_letter_templates (name, body_html, is_default)
VALUES (
  'Standard Offer Letter',
  '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
    <p style="text-align: right; color: #666;">Date: {{OfferDate}}</p>
    <p>Dear <strong>{{CandidateName}}</strong>,</p>
    <p>We are pleased to offer you the position of <strong>{{Designation}}</strong> in the <strong>{{Department}}</strong> department at <strong>{{CompanyName}}</strong>.</p>
    <p>Your employment will commence on <strong>{{JoiningDate}}</strong>.</p>
    <h3>Compensation Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Annual CTC</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{{AnnualCTC}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Monthly Gross</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{{MonthlyGross}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Basic Salary</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{{BasicSalary}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>HRA</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{{HRA}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Special Allowance</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{{SpecialAllowance}}</td></tr>
    </table>
    <p><strong>Work Location:</strong> {{WorkLocation}}</p>
    <p>This offer is contingent upon satisfactory completion of our background verification process.</p>
    <p>We look forward to welcoming you to the team!</p>
    <br/>
    <p>Sincerely,</p>
    <p><strong>HR Department</strong><br/>{{CompanyName}}</p>
  </div>',
  TRUE
) ON CONFLICT DO NOTHING;
