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
  'Official Corporate Offer Letter',
  '<div style="font-family: ''Helvetica Neue'', Helvetica, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 50px; color: #333; line-height: 1.6;">
    
    <!-- Header -->
    <div style="border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
            <h1 style="color: #1e40af; margin: 0; font-size: 28px; letter-spacing: 1px;">{{CompanyName}}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Corporate Headquarters<br/>{{WorkLocation}}</p>
        </div>
        <div style="text-align: right; font-size: 14px; color: #555;">
            <strong>Date:</strong> {{OfferDate}}<br/>
            <strong>Ref:</strong> HR/OFF/{{JoiningDate}}
        </div>
    </div>

    <!-- Candidate Info -->
    <div style="margin-bottom: 30px;">
        <p style="margin: 0;"><strong>To,</strong></p>
        <p style="margin: 5px 0 0 0; font-size: 16px;"><strong>{{CandidateName}}</strong></p>
        <p style="margin: 2px 0 0 0;">{{CandidateEmail}}</p>
        <p style="margin: 2px 0 0 0;">{{CandidateMobile}}</p>
    </div>

    <!-- Subject -->
    <div style="margin-bottom: 30px; text-align: center;">
        <h3 style="margin: 0; text-transform: uppercase; letter-spacing: 1px; font-size: 16px; border-bottom: 1px solid #ddd; display: inline-block; padding-bottom: 5px;">Letter of Offer for Employment</h3>
    </div>

    <p>Dear <strong>{{CandidateName}}</strong>,</p>
    
    <p>Following our recent discussions, we are delighted to offer you the position of <strong>{{Designation}}</strong> in the <strong>{{Department}}</strong> department at <strong>{{CompanyName}}</strong>. We were highly impressed with your background and skills, and we believe you will be a valuable addition to our team.</p>

    <p>Your scheduled date of joining will be <strong>{{JoiningDate}}</strong>. Your primary work location will be {{WorkLocation}}, and you will be reporting to {{ReportingManager}}.</p>

    <h4 style="color: #1e40af; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px;">1. Compensation & Benefits</h4>
    <p>Your Annual Cost to Company (CTC) will be <strong>₹{{AnnualCTC}}</strong>. A detailed breakup of your compensation is provided below:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; box-shadow: 0 0 10px rgba(0,0,0,0.02);">
        <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 12px 15px; color: #334155;">Salary Component</th>
                <th style="padding: 12px 15px; color: #334155; text-align: right;">Monthly Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px;">Basic Salary</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold;">₹{{BasicSalary}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px;">House Rent Allowance (HRA)</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold;">₹{{HRA}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px;">Special Allowance</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold;">₹{{SpecialAllowance}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                <td style="padding: 12px 15px; font-weight: bold; color: #1e40af;">Gross Monthly Salary</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold; color: #1e40af; font-size: 15px;">₹{{MonthlyGross}}</td>
            </tr>
        </tbody>
    </table>

    <h4 style="color: #1e40af; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px;">2. Standard Terms of Employment</h4>
    <ul style="padding-left: 20px; margin-top: 10px;">
        <li style="margin-bottom: 8px;"><strong>Probation:</strong> You will be on a probation period of 3 months from your date of joining.</li>
        <li style="margin-bottom: 8px;"><strong>Notice Period:</strong> Post confirmation, either party may terminate this agreement by providing a 30-day written notice.</li>
        <li style="margin-bottom: 8px;"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) upon joining.</li>
        <li style="margin-bottom: 8px;"><strong>Background Check:</strong> This offer is subject to satisfactory clearance of background and reference checks.</li>
    </ul>

    <p style="margin-top: 30px;">Please signify your acceptance of these terms and conditions by signing and returning the duplicate copy of this letter on or before <strong>[Expiry Date]</strong>.</p>
    
    <p>We are excited to have you on board and look forward to a mutually rewarding professional relationship.</p>

    <!-- Signatures -->
    <div style="margin-top: 60px; display: flex; justify-content: space-between;">
        <div>
            <p style="margin: 0; font-weight: bold;">For {{CompanyName}}</p>
            <div style="height: 60px; margin: 10px 0; border-bottom: 1px solid #333; width: 200px;"></div>
            <p style="margin: 0; font-size: 14px; color: #555;">Authorized Signatory<br/>Human Resources</p>
        </div>
        <div>
            <p style="margin: 0; font-weight: bold;">Accepted & Agreed</p>
            <div style="height: 60px; margin: 10px 0; border-bottom: 1px solid #333; width: 200px;"></div>
            <p style="margin: 0; font-size: 14px; color: #555;">{{CandidateName}}<br/>Date: ____________</p>
        </div>
    </div>
</div>',
  TRUE
) ON CONFLICT DO NOTHING;
