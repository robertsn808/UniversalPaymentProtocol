@extends('backend.layouts.user')

@section('page-title', trans('app.add_shop'))
@section('page-heading', trans('app.add_shop'))

@section('content')


<div class="row wow fadeIn">
	<div class="col-lg-12">
		<section class="content-header">
			@include('backend.partials.messages')
		</section>
		<div class="element-wrapper">
			<div class="element-box">
				<div class="element-info mb-3">
					<div class="element-info-with-icon">
						<div class="element-info-icon">
							<div class="fa fa-pie-chart"></div>
						</div>
						<div class="element-info-text">
							<h5 class="element-inner-header">@lang('app.add_shop')</h5>
							<div class="element-inner-desc text-primary">
							</div>
						</div>
					</div>
				</div>
				<section class="content">
					<form action="{{ route('backend.shop.store') }}" method="POST" enctype="multipart/form-data" id="user-form">
						@csrf
						<div class="box box-default">

							<div class="box-body">
								@foreach(['shop' => 'shop', '3' => 'manager', '2' => 'cashier'] as $role_id => $role_name)

									@if($role_id == 'shop')

										<!-- <h4>@lang('app.shop')</h4> -->

										@include('backend.shops.partials.base', ['edit' => false, 'profile' => false])


									@else

										<h4>{{ strtoupper($role_name) }}</h4>

										<div class="row">
											<div class="col-md-6">
												<div class="form-group">
													<label>@lang('app.username')</label>
													<input type="text" class="form-control" id="username" name="{{ $role_name }}[username]" placeholder="(@lang('app.optional'))" value="{{ old($role_name)['username'] }}">
												</div>
											</div>
											<div class="col-md-6">
												<div class="form-group">
													<label>@lang('app.status')</label>
													<select name="{{ $role_name }}[status]" class="form-control" id="status">
														@foreach($statuses as $key => $value)
															<option value="{{ $key }}" {{ old($role_name)['status'] == $key ? 'selected' : '' }}>{{ $value }}</option>
														@endforeach
													</select>
												</div>
											</div>

											<div class="col-md-6">
												<div class="form-group">
													<label>{{ trans('app.password') }}</label>
													<input type="password" class="form-control" id="password" name="{{ $role_name }}[password]" value="{{ old($role_name)['password'] }}">
												</div>
											</div>
										</div>

									@endif

									<hr>

								@endforeach




							</div>

							<div class="box-footer">
								<button type="submit" class="btn btn-primary">
									@lang('app.add_shop')
								</button>
							</div>
						</div>
					</form>
				</section>
			</div>
		</div>
	</div>
</div>


@stop