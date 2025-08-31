@extends('backend.layouts.app')

@section('page-title', trans('app.general_settings'))
@section('page-heading', trans('app.general_settings'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.settings.list.update', 'payment') }}" method="POST" id="general-settings-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.general_settings')</h3>
			</div>

			<div class="box-body">
				<div class="row">

					<div class="col-md-6">

						<div class="form-group">
							<label>@lang('app.default_currency')</label>
							@php
								$currencies = array_combine(\VanguardLTE\Shop::$values['currency'], \VanguardLTE\Shop::$values['currency']);
							@endphp
							<select name="default_currency" class="form-control">
								@foreach($currencies as $key => $currency)
									<option value="{{ $key }}" {{ settings('default_currency', 'USD') == $key ? 'selected' : '' }}>
										{{ $currency }}
									</option>
								@endforeach
							</select>
						</div>

						<div class="form-group">
							<label>@lang('app.minimum_payment_amount')</label>
							<input type="number" step="0.0000001" name="minimum_payment_amount" class="form-control" value="{{ settings('minimum_payment_amount', 0) }}">
						</div>

						<div class="form-group">
							<label>@lang('app.maximum_payment_amount')</label>
							<input type="number" step="0.0000001" name="maximum_payment_amount" class="form-control" value="{{ settings('maximum_payment_amount', 10000) }}">
						</div>


					</div>

					<div class="col-md-6">

						<div class="form-group">
							<label>
								IK
							</label>
							<select name="payment_interkassa" class="form-control">
								<option value="0" {{ settings('payment_interkassa') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('payment_interkassa') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>
						<div class="form-group">
							<label>
								CB
							</label>
							<select name="payment_coinbase" class="form-control">
								<option value="0" {{ settings('payment_coinbase') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('payment_coinbase') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>
						<div class="form-group">
							<label>
								BP
							</label>
							<select name="payment_btcpayserver" class="form-control">
								<option value="0" {{ settings('payment_btcpayserver') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('payment_btcpayserver') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>
						<div class="form-group">
							<label>
								Pin
							</label>
							<select name="payment_pin" class="form-control">
								<option value="0" {{ settings('payment_pin') == 0 ? 'selected' : '' }}>
									@lang('app.no')
								</option>
								<option value="1" {{ settings('payment_pin') == 1 ? 'selected' : '' }}>
									@lang('app.yes')
								</option>
							</select>
						</div>


					</div>

				</div>

				<hr>

				<h4>Interkassa</h4>
				<div class="row">
					@foreach(config('payments.interkassa.fields') as $field)
						<div class="col-md-6">
							<div class="form-group">
								<label>{{ $field }}</label>
								<input type="text" class="form-control" name="system[interkassa][{{ $field }}][{{ auth()->user()->shop_id }}]" value="{{ \VanguardLTE\Lib\Setting::get_value('interkassa', $field, auth()->user()->shop_id) }}">
							</div>
						</div>
					@endforeach
				</div>

				<h4>Coinbase</h4>
				<div class="row">
					@foreach(config('payments.coinbase.fields') as $field)
						<div class="col-md-6">
							<div class="form-group">
								<label>{{ $field }}</label>
								<input type="text" class="form-control" name="system[coinbase][{{ $field }}][{{ auth()->user()->shop_id }}]" value="{{ \VanguardLTE\Lib\Setting::get_value('coinbase', $field, auth()->user()->shop_id) }}">
							</div>
						</div>
					@endforeach
				</div>

				<h4>BtcPayServer</h4>
				<div class="row">
					@foreach(config('payments.btcpayserver.fields') as $field)
						<div class="col-md-6">
							<div class="form-group">
								<label>{{ $field }}</label>
								<input type="text" class="form-control" name="system[btcpayserver][{{ $field }}][{{ auth()->user()->shop_id }}]" value="{{ \VanguardLTE\Lib\Setting::get_value('btcpayserver', $field, auth()->user()->shop_id) }}">
							</div>
						</div>
					@endforeach
				</div>

			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_settings')
				</button>



			</div>
		</form>
	</div>
</section>

@stop