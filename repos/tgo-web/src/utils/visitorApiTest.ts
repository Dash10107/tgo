/**
 * Visitor API test tool
 * Used to test the visitor attribute update feature
 */

import { visitorApiService } from '@/services/visitorApi';
import type { VisitorAttributesUpdateRequest } from '@/services/visitorApi';

/**
 * Test the visitor attribute update feature
 */
export const testVisitorAttributeUpdate = async (visitorId: string): Promise<void> => {
  console.log('🧪 Starting visitor attribute update test...');

  try {
    // 1. Test basic info update
    console.log('🧪 Testing basic info update...');
    const basicInfoUpdate: VisitorAttributesUpdateRequest = {
      name: 'Test User',
      email: 'test@example.com',
      phone_number: '+86 138-0000-0000'
    };

    const basicInfoResponse = await visitorApiService.updateVisitorAttributes(visitorId, basicInfoUpdate);
    console.log('✅ Basic info updated successfully:', basicInfoResponse);

    // 2. Test company and job title update
    console.log('🧪 Testing company and job title update...');
    const companyUpdate: VisitorAttributesUpdateRequest = {
      company: 'Test Technology Co., Ltd.',
      job_title: 'Product Manager',
      source: 'Website inquiry'
    };

    const companyResponse = await visitorApiService.updateVisitorAttributes(visitorId, companyUpdate);
    console.log('✅ Company info updated successfully:', companyResponse);

    // 3. Test custom attribute update
    console.log('🧪 Testing custom attribute update...');
    const customAttributesUpdate: VisitorAttributesUpdateRequest = {
      custom_attributes: {
        'Hobbies': 'Reading, travel',
        'Purchase intent': 'High',
        'Budget range': '100k-500k',
        'Decision cycle': 'Within 3 months'
      }
    };

    const customAttributesResponse = await visitorApiService.updateVisitorAttributes(visitorId, customAttributesUpdate);
    console.log('✅ Custom attributes updated successfully:', customAttributesResponse);

    // 4. Test note update
    console.log('🧪 Testing note update...');
    const noteUpdate: VisitorAttributesUpdateRequest = {
      note: 'An important potential customer who has shown strong interest in our products and needs close follow-up. A product demo is scheduled for next week.'
    };

    const noteResponse = await visitorApiService.updateVisitorAttributes(visitorId, noteUpdate);
    console.log('✅ Note updated successfully:', noteResponse);

    // 5. Test comprehensive update
    console.log('🧪 Testing comprehensive update...');
    const comprehensiveUpdate: VisitorAttributesUpdateRequest = {
      name: 'Comprehensive Test User',
      email: 'comprehensive@test.com',
      phone_number: '+86 139-0000-0000',
      company: 'Comprehensive Test Technology Co., Ltd.',
      job_title: 'Technical Director',
      source: 'Friend referral',
      note: 'Note for a comprehensive feature test, covering all updatable fields.',
      custom_attributes: {
        'Test type': 'Comprehensive test',
        'Test time': new Date().toISOString(),
        'Test status': 'In progress',
        'Priority': 'High'
      }
    };

    const comprehensiveResponse = await visitorApiService.updateVisitorAttributes(visitorId, comprehensiveUpdate);
    console.log('✅ Comprehensive update succeeded:', comprehensiveResponse);

    console.log('🎉 All visitor attribute update tests passed!');

  } catch (error) {
    console.error('❌ Visitor attribute update test failed:', error);
    throw error;
  }
};

/**
 * Test the get-visitor-info feature
 */
export const testGetVisitor = async (visitorId: string): Promise<void> => {
  console.log('🧪 Starting get-visitor-info test...');

  try {
    const visitorResponse = await visitorApiService.getVisitor(visitorId);
    console.log('✅ Visitor info fetched successfully:', visitorResponse);

    // Test data transformation
    const transformedVisitor = visitorApiService.transformToVisitor(visitorResponse);
    console.log('✅ Visitor data transformed successfully:', transformedVisitor);

    console.log('🎉 Get-visitor-info test passed!');

  } catch (error) {
    console.error('❌ Get-visitor-info test failed:', error);
    throw error;
  }
};

/**
 * Test the visitor data transformation feature
 */
export const testVisitorDataTransform = async (visitorId: string): Promise<void> => {
  console.log('🧪 Starting visitor data transformation test...');

  try {
    const visitorResponse = await visitorApiService.getVisitor(visitorId);
    console.log('✅ Visitor info fetched successfully:', visitorResponse);

    const transformedVisitor = visitorApiService.transformToVisitor(visitorResponse);
    console.log('✅ Visitor data transformed successfully:', transformedVisitor);

    console.log('🎉 Visitor data transformation test passed!');

  } catch (error) {
    console.error('❌ Visitor data transformation test failed:', error);
    throw error;
  }
};

/**
 * Run all visitor API tests
 */
export const runAllVisitorApiTests = async (visitorId: string): Promise<void> => {
  console.log('🚀 Running all visitor API tests...');

  try {
    await testGetVisitor(visitorId);
    await testVisitorDataTransform(visitorId);
    await testVisitorAttributeUpdate(visitorId);

    console.log('🎉 All visitor API tests complete!');

  } catch (error) {
    console.error('❌ Visitor API test failed:', error);
  }
};

/**
 * Expose the test functions in the browser console
 */
if (typeof window !== 'undefined') {
  (window as any).testVisitorAttributeUpdate = testVisitorAttributeUpdate;
  (window as any).testGetVisitor = testGetVisitor;
  (window as any).testVisitorDataTransform = testVisitorDataTransform;
  (window as any).runAllVisitorApiTests = runAllVisitorApiTests;

  console.log('🧪 Visitor API test tool loaded');
  console.log('🧪 Use testVisitorAttributeUpdate("visitor_id") to test attribute updates');
  console.log('🧪 Use testGetVisitor("visitor_id") to test fetching visitor info');
  console.log('🧪 Use testVisitorDataTransform("visitor_id") to test data transformation');
  console.log('🧪 Use runAllVisitorApiTests("visitor_id") to run all tests');
}
