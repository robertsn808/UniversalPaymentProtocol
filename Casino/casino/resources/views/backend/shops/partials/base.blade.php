<div class="row">

	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.title')))
		<div class="col-md-6">
			<div class="form-group">
				<label>@lang('app.title')</label>
				<input type="text" class="form-control" id="title" name="name" placeholder="@lang('app.title')" required value="{{ $edit ? $shop->name : old('name') }}">
			</div>
		</div>
	@endif



	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.percent')</label>
			@php
				$percents = array_combine(\VanguardLTE\Shop::$values['percent'], \VanguardLTE\Shop::$values['percent_labels']);
			@endphp
			<select name="percent" class="form-control">
				@foreach (\VanguardLTE\Shop::$values['percent_labels'] as $value => $label)
					<option value="{{ $value }}" {{ ($edit ? $shop->percent : (old('percent') ?: '90')) == $value ? 'selected' : '' }}>{{ $label }}</option>
				@endforeach
			</select>
		</div>
	</div>


	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.frontend')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.frontend')</label>
				<select name="frontend" class="form-control">
					@foreach ($directories as $value => $label)
						<option value="{{ $label }}" {{ ($edit ? $shop->frontend : (old('frontend') ?: 'Default')) == $label ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif



	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.order')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.order')</label>
				@php
					$orders = array_combine(\VanguardLTE\Shop::$values['orderby'], \VanguardLTE\Shop::$values['orderby']);
				@endphp
				<select name="orderby" class="form-control">
					@foreach ($orders as $value => $label)
						<option value="{{ $value }}" {{ ($edit ? $shop->orderby : old('orderby')) == $value ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif

	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.currency')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.currency')</label>
				@php
					$currencies = array_combine(\VanguardLTE\Shop::$values['currency'], \VanguardLTE\Shop::$values['currency']);
				@endphp
				<select name="currency" class="form-control">
					@foreach ($currencies as $value => $label)
						<option value="{{ $value }}" {{ ($edit ? $shop->currency : (old('currency') ?: 'USD')) == $value ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif



	<div class="col-md-6">
		<div class="form-group">
			<label for="device"> @lang('app.categories')</label>
			<select class="form-control select2" name="categories[]" {{ $edit ? 'disabled' : ''  }} multiple="multiple" style="width: 100%;" required>
				<option value="0" {{ ((old('categories') && in_array(0, old('categories'))) || ($edit && in_array(0, $cats))) ? 'selected' : '' }}>All</option>
				@foreach ($categories as $key => $category)
							<option value="{{ $category->id }}" {{
					((old('categories') && in_array($category->id, old('categories'))) || ($edit && in_array($category->id, $cats)))
					? 'selected' : '' }}>{{ $category->title }}</option>
							@foreach ($category->inner as $inner)
									<option value="{{ $inner->id }}" {{
								((old('categories') && in_array($inner->id, old('categories')) || ($edit && in_array($inner->id, $cats)))) ? 'selected' : ''

														}}>{{ $inner->title }}</option>
							@endforeach
				@endforeach
			</select>
		</div>
	</div>


	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.max_win')))
		<div class="col-md-6">
			<div class="form-group">
				<label>@lang('app.max_win')</label>
				@php
					$max_win = array_combine(\VanguardLTE\Shop::$values['max_win'], \VanguardLTE\Shop::$values['max_win']);
				@endphp
				<select name="max_win" class="form-control">
					@foreach ($max_win as $value => $label)
						<option value="{{ $value }}" {{ ($edit ? $shop->max_win : (old('max_win') ?: '100')) == $value ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif







	@if(!$edit || ($edit && auth()->user()->hasRole('admin')))
		<div class="col-md-6">
			<div class="form-group">
				<label>@lang('app.shop_limit')</label>
				@php
					$shop_limits = array_combine(\VanguardLTE\Shop::$values['shop_limit'], \VanguardLTE\Shop::$values['shop_limit']);
				@endphp
				<select name="shop_limit" class="form-control">
					@foreach ($shop_limits as $value => $label)
						<option value="{{ $value }}" {{ ($edit ? $shop->shop_limit : (old('shop_limit') ?: '200')) == $value ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif
	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.country')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.country')</label>
				@php $countries = [
					'Afghanistan',
					'Albania',
					'Algeria',
					'American Samoa',
					'Andorra',
					'Angola',
					'Anguilla',
					'Antarctica',
					'Antigua and Barbuda',
					'Argentina',
					'Armenia',
					'Aruba',
					'Australia',
					'Austria',
					'Azerbaijan',
					'Bahamas',
					'Bahrain',
					'Bangladesh',
					'Barbados',
					'Belarus',
					'Belgium',
					'Belize',
					'Benin',
					'Bermuda',
					'Bhutan',
					'Bolivia',
					'Bonaire, Sint Eustatius, and Saba',
					'Bosnia and Herzegovina',
					'Botswana',
					'Bouvet Island',
					'Brazil',
					'British Indian Ocean Territory',
					'British Virgin Islands',
					'Brunei',
					'Bulgaria',
					'Burkina Faso',
					'Burundi',
					'Cabo Verde',
					'Cambodia',
					'Cameroon',
					'Canada',
					'Cayman Islands',
					'Central African Republic',
					'Chad',
					'Chile',
					'China',
					'Christmas Island',
					'Cocos [Keeling] Islands',
					'Colombia',
					'Comoros',
					'Congo Republic',
					'Cook Islands',
					'Costa Rica',
					'Croatia',
					'Cuba',
					'Curaçao',
					'Cyprus',
					'Czechia',
					'DR Congo',
					'Denmark',
					'Djibouti',
					'Dominica',
					'Dominican Republic',
					'East Timor',
					'Ecuador',
					'Egypt',
					'El Salvador',
					'Equatorial Guinea',
					'Eritrea',
					'Estonia',
					'Eswatini',
					'Ethiopia',
					'Falkland Islands',
					'Faroe Islands',
					'Federated States of Micronesia',
					'Fiji',
					'Finland',
					'France',
					'French Guiana',
					'French Polynesia',
					'French Southern Territories',
					'Gabon',
					'Gambia',
					'Georgia',
					'Germany',
					'Ghana',
					'Gibraltar',
					'Greece',
					'Greenland',
					'Grenada',
					'Guadeloupe',
					'Guam',
					'Guatemala',
					'Guernsey',
					'Guinea',
					'Guinea-Bissau',
					'Guyana',
					'Haiti',
					'Hashemite Kingdom of Jordan',
					'Heard Island and McDonald Islands',
					'Honduras',
					'Hong Kong',
					'Hungary',
					'Iceland',
					'India',
					'Indonesia',
					'Iran',
					'Iraq',
					'Ireland',
					'Isle of Man',
					'Israel',
					'Italy',
					'Ivory Coast',
					'Jamaica',
					'Japan',
					'Jersey',
					'Kazakhstan',
					'Kenya',
					'Kiribati',
					'Kosovo',
					'Kuwait',
					'Kyrgyzstan',
					'Laos',
					'Latvia',
					'Lebanon',
					'Lesotho',
					'Liberia',
					'Libya',
					'Liechtenstein',
					'Luxembourg',
					'Macao',
					'Madagascar',
					'Malawi',
					'Malaysia',
					'Maldives',
					'Mali',
					'Malta',
					'Marshall Islands',
					'Martinique',
					'Mauritania',
					'Mauritius',
					'Mayotte',
					'Mexico',
					'Monaco',
					'Mongolia',
					'Montenegro',
					'Montserrat',
					'Morocco',
					'Mozambique',
					'Myanmar',
					'Namibia',
					'Nauru',
					'Nepal',
					'Netherlands',
					'New Caledonia',
					'New Zealand',
					'Nicaragua',
					'Niger',
					'Nigeria',
					'Niue',
					'Norfolk Island',
					'North Korea',
					'North Macedonia',
					'Northern Mariana Islands',
					'Norway',
					'Oman',
					'Pakistan',
					'Palau',
					'Palestine',
					'Panama',
					'Papua New Guinea',
					'Paraguay',
					'Peru',
					'Philippines',
					'Pitcairn Islands',
					'Poland',
					'Portugal',
					'Puerto Rico',
					'Qatar',
					'Republic of Lithuania',
					'Republic of Moldova',
					'Romania',
					'Russia',
					'Rwanda',
					'Réunion',
					'Saint Barthélemy',
					'Saint Helena',
					'Saint Lucia',
					'Saint Martin',
					'Saint Pierre and Miquelon',
					'Saint Vincent and the Grenadines',
					'Samoa',
					'San Marino',
					'Saudi Arabia',
					'Senegal',
					'Serbia',
					'Seychelles',
					'Sierra Leone',
					'Singapore',
					'Sint Maarten',
					'Slovakia',
					'Slovenia',
					'Solomon Islands',
					'Somalia',
					'South Africa',
					'South Georgia and the South Sandwich Islands',
					'South Korea',
					'South Sudan',
					'Spain',
					'Sri Lanka',
					'St Kitts and Nevis',
					'Sudan',
					'Suriname',
					'Svalbard and Jan Mayen',
					'Sweden',
					'Switzerland',
					'Syria',
					'São Tomé and Príncipe',
					'Taiwan',
					'Tajikistan',
					'Tanzania',
					'Thailand',
					'Togo',
					'Tokelau',
					'Tonga',
					'Trinidad and Tobago',
					'Tunisia',
					'Turkey',
					'Turkmenistan',
					'Turks and Caicos Islands',
					'Tuvalu',
					'U.S. Minor Outlying Islands',
					'U.S. Virgin Islands',
					'Uganda',
					'Ukraine',
					'United Arab Emirates',
					'United Kingdom',
					'United States',
					'Uruguay',
					'Uzbekistan',
					'Vanuatu',
					'Vatican City',
					'Venezuela',
					'Vietnam',
					'Wallis and Futuna',
					'Western Sahara',
					'Yemen',
					'Zambia',
					'Zimbabwe',
					'Åland'
				]; @endphp
				<select name="country[]" class="form-control select2" style="width: 100%" multiple>
					@foreach (array_combine($countries, $countries) as $value => $label)
						<option value="{{ $value }}" {{ in_array($value, $edit ? $shop->countries->pluck('country')->toArray() : old('country', [])) ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif


	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.os')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.os')</label>
				@php $os = [
					'Windows',
					'iPad',
					'iPhone',
					'Mac OS X',
					'Android',
					'Linux',
				]; @endphp
				<select name="os[]" class="form-control select2" style="width: 100%" multiple>
					@foreach (array_combine($os, $os) as $value => $label)
						<option value="{{ $value }}" {{ in_array($value, $edit ? $shop->oss->pluck('os')->toArray() : old('os', [])) ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif

	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.device')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.device')</label>
				@php $devices = ['Computer', 'Mobile', 'Tablet']; @endphp
				<select name="device[]" class="form-control select2" style="width: 100%" multiple>
					@foreach (array_combine($devices, $devices) as $value => $label)
						<option value="{{ $value }}" {{ in_array($value, $edit ? $shop->devices->pluck('device')->toArray() : old('device', [])) ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif

	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.terms_and_conditions')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.rules_terms_and_conditions')</label>
				<select name="rules_terms_and_conditions" class="form-control">
					<option value="0" {{ ($edit ? $shop->rules_terms_and_conditions : old('rules_terms_and_conditions')) == 0 ? 'selected' : '' }}>{{ __('app.no') }}</option>
					<option value="1" {{ ($edit ? $shop->rules_terms_and_conditions : old('rules_terms_and_conditions')) == 1 ? 'selected' : '' }}>{{ __('app.yes') }}</option>
				</select>
			</div>
		</div>
	@endif
	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.privacy_policy')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.rules_privacy_policy')</label>
				<select name="rules_privacy_policy" class="form-control">
					<option value="0" {{ ($edit ? $shop->rules_privacy_policy : old('rules_privacy_policy')) == 0 ? 'selected' : '' }}>{{ __('app.no') }}</option>
					<option value="1" {{ ($edit ? $shop->rules_privacy_policy : old('rules_privacy_policy')) == 1 ? 'selected' : '' }}>{{ __('app.yes') }}</option>
				</select>
			</div>
		</div>
	@endif
	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.general_bonus_policy')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.rules_general_bonus_policy')</label>
				<select name="rules_general_bonus_policy" class="form-control">
					<option value="0" {{ ($edit ? $shop->rules_general_bonus_policy : old('rules_general_bonus_policy')) == 0 ? 'selected' : '' }}>{{ __('app.no') }}</option>
					<option value="1" {{ ($edit ? $shop->rules_general_bonus_policy : old('rules_general_bonus_policy')) == 1 ? 'selected' : '' }}>{{ __('app.yes') }}</option>
				</select>
			</div>
		</div>
	@endif
	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.why_bitcoin')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.rules_why_bitcoin')</label>
				<select name="rules_why_bitcoin" class="form-control">
					<option value="0" {{ ($edit ? $shop->rules_why_bitcoin : old('rules_why_bitcoin')) == 0 ? 'selected' : '' }}>{{ __('app.no') }}</option>
					<option value="1" {{ ($edit ? $shop->rules_why_bitcoin : old('rules_why_bitcoin')) == 1 ? 'selected' : '' }}>{{ __('app.yes') }}</option>
				</select>
			</div>
		</div>
	@endif
	@if(!$edit || ($edit && auth()->user()->hasPermission('shops.responsible_gaming')))
		<div class="col-md-6">
			<div class="form-group">
				<label> @lang('app.rules_responsible_gaming')</label>
				<select name="rules_responsible_gaming" class="form-control">
					<option value="0" {{ ($edit ? $shop->rules_responsible_gaming : old('rules_responsible_gaming')) == 0 ? 'selected' : '' }}>{{ __('app.no') }}</option>
					<option value="1" {{ ($edit ? $shop->rules_responsible_gaming : old('rules_responsible_gaming')) == 1 ? 'selected' : '' }}>{{ __('app.yes') }}</option>
				</select>
			</div>
		</div>
	@endif

	<div class="col-md-6">
		<div class="form-group">
			<label> Pending - set to 1 to temporary disable shop</label>
			<select name="pending" class="form-control">
				<option value="1" {{ old('pending') == 1 ? 'selected' : '' }}>1</option>
				<option value="0" {{ old('pending') == 0 ? 'selected' : '' }}>0</option>
			</select>
		</div>
	</div>

	<div class="col-md-6">
		<div class="form-group">
			<label> Shop access </label>
			<select name="access" class="form-control">
				<option value="1" {{ old('access') == 1 ? 'selected' : '' }}>1</option>
				<option value="0" {{ old('access') == 0 ? 'selected' : '' }}>0</option>
			</select>
		</div>
	</div>


	@if($edit && count($blocks))
		<div class="col-md-6">
			<div class="form-group">
				<label for="device">
					@lang('app.status'):
					@if($shop->is_blocked)
						@lang('app.block')
					@else
						@lang('app.unblock')
					@endif
				</label>
				<select name="is_blocked" class="form-control">
					<option value="" {{ ($edit ? $shop->is_blocked : old('is_blocked')) == '' ? 'selected' : '' }}>---</option>
					@foreach ($blocks as $value => $label)
						<option value="{{ $value }}" {{ ($edit ? $shop->is_blocked : old('is_blocked')) == $value ? 'selected' : '' }}>{{ $label }}</option>
					@endforeach
				</select>
			</div>
		</div>
	@endif


	@if(isset($balance))
		<div class="col-md-6">
			<div class="form-group">
				<label>{{ trans('app.balance') }}</label>
				<input type="text" class="form-control" name="balance" value="{{ old('balance') ?: 0 }}">
			</div>
		</div>
	@endif
</div>